import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { type Product, type Slot } from "@/lib/catalog";
import { getProductCatalog } from "@/lib/product-repository";
import { getActivity } from "@/lib/activities";
import { createCoverage, coverageGaps } from "@/lib/coverage";
import { loadOpenAIAgentSession, saveOpenAIAgentSession, saveRun, supabaseConfigured } from "@/lib/supabase-server";
import { continueAgentJourney, createAgentJourney, openAIAgentConfigured } from "@/lib/openai-agent-server";

export const runtime="nodejs";
const slots=["backpack","shelter","bag","pad","stove","water-treatment","headlamp","first-aid","running-shoes","hydration"] as const;
const requestSchema=z.object({runId:z.string().min(8).max(80),requirements:z.object({version:z.number().int().positive(),activityId:z.string(),answers:z.record(z.string(),z.string()),budgetCents:z.number().int().positive().nullable(),reserveCents:z.number().int().min(0).nullable(),coveredSlots:z.array(z.string()).max(12),priority:z.string().max(80)})});
type Requirements=z.infer<typeof requestSchema>["requirements"];
type AgentProduct={id?:unknown;slot?:unknown;name?:unknown;brand?:unknown;product_url?:unknown;image_url?:unknown;price_cents?:unknown;facts?:unknown;evidence_source?:unknown;checked_at?:unknown;why?:unknown};

function isSlot(value:unknown):value is Slot{return typeof value==="string"&&(slots as readonly string[]).includes(value);}
function sourceUrl(value:unknown){try{const url=new URL(String(value));return url.protocol==="https:"?url:null;}catch{return null;}}
function directSource(url:URL){return url.hostname.endsWith("rei.com")?url.pathname.includes("/product/"):true;}
function officialImage(value:unknown,product:URL){const image=sourceUrl(value);if(!image)return undefined;const fromRei=image.hostname.endsWith("rei.com");const sameManufacturer=image.hostname===product.hostname;return fromRei||sameManufacturer?image.toString():undefined;}
function slug(value:string){return value.toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/(^-|-$)/g,"").slice(0,72);}
function webProducts(items:unknown,activityId:string,known:Product[]){
 if(!Array.isArray(items))return [] as Product[];
 const knownIds=new Set(known.map(product=>product.id));
 return (items as AgentProduct[]).flatMap((item,index)=>{
  if(typeof item.id==="string"&&knownIds.has(item.id))return [];
  if(!isSlot(item.slot)||typeof item.name!=="string"||typeof item.brand!=="string")return [];
  const page=sourceUrl(item.product_url);if(!page||!directSource(page))return [];
  const price=typeof item.price_cents==="number"&&Number.isInteger(item.price_cents)&&item.price_cents>0?item.price_cents:undefined;
  const facts=Array.isArray(item.facts)?item.facts.filter((fact):fact is string=>typeof fact==="string").slice(0,6):[];
  const checked=typeof item.checked_at==="string"&&/^\d{4}-\d{2}-\d{2}$/.test(item.checked_at)?item.checked_at:new Date().toISOString().slice(0,10);
  const source=page.hostname.endsWith("rei.com")?"REI product page" as const:"Manufacturer" as const;
  return [{id:`web-${item.slot}-${slug(item.brand)}-${slug(item.name)}-${index}`,slot:item.slot,activities:[activityId] as Product["activities"],brand:item.brand,name:item.name,priceCents:price,sourceUrl:page.toString(),searchUrl:`https://www.rei.com/search?q=${encodeURIComponent(`${item.brand} ${item.name}`)}`,source,verifiedAt:checked,imageUrl:officialImage(item.image_url,page),facts,evidence:typeof item.evidence_source==="string"?item.evidence_source:`Direct ${source} page found with live web search.`}];
 });
}
function validate(products:Product[],r:Requirements,ids:string[]){
 const activity=getActivity(r.activityId);const items=ids.map(id=>products.find(product=>product.id===id)).filter(Boolean) as Product[];const available=r.budgetCents===null||r.reserveCents===null?null:r.budgetCents-r.reserveCents;const required=(activity?.slots||[]).filter(slot=>!r.coveredSlots.includes(slot));const errors:string[]=[];
 if(!activity)errors.push("WRONG_ACTIVITY");if(ids.length!==items.length||new Set(ids).size!==ids.length)errors.push("UNKNOWN_PRODUCT");if(items.some(product=>!product.activities.includes(r.activityId as never)))errors.push("WRONG_ACTIVITY");for(const slot of required)if(!items.some(product=>product.slot===slot))errors.push(`MISSING_REQUIRED_SLOT:${slot}`);
 const hasUnknownPrice=items.some(product=>product.priceCents===undefined);const total=items.reduce((sum,product)=>sum+(product.priceCents||0),0);if(available!==null&&total>available)errors.push("OVER_BUDGET");
 const coverage=createCoverage(r.activityId as never,r.coveredSlots);const unresolved=[...coverageGaps(coverage).map(row=>`${row.category}: ${row.reason||(row.state==="no_verified_match"?"No sourced product found":"Product needed")}`)];if(available===null)unresolved.push("Budget was not entered; this proposal is not verified within a budget.");else if(hasUnknownPrice)unresolved.push("One or more sourced products have no recorded price; the full setup is not verified within budget.");
 return {status:errors.length?"infeasible":"validated",errors,totalCents:total,availableCents:available,budgetVerified:available!==null&&!hasUnknownPrice,unresolved,coverage,token:`v${r.version}-${ids.slice().sort().join("-")}`};
}
function fallback(products:Product[],r:Requirements){const activity=getActivity(r.activityId);if(!activity)return null;const ids=activity.slots.filter(slot=>!r.coveredSlots.includes(slot)).map(slot=>products.filter(product=>product.activities.includes(activity.id)&&product.slot===slot&&product.priceCents!==undefined).sort((a,b)=>(a.priceCents||0)-(b.priceCents||0))[0]?.id).filter(Boolean) as string[];const validation=validate(products,r,ids);return validation.status==="validated"?{productIds:ids,reasons:Object.fromEntries(ids.map(id=>[id,"Lowest recorded-price source-backed option for this required category; fit and availability still need checking."])),validation}:null;}
function parse(text:string){try{return JSON.parse(text.replace(/^```(?:json)?\s*|\s*```$/g,""));}catch{return null;}}
function prompt(r:Requirements,products:Product[]){const activity=getActivity(r.activityId)!;const catalog=products.filter(product=>product.activities.includes(activity.id)).map(product=>({id:product.id,slot:product.slot,brand:product.brand,name:product.name,price_cents:product.priceCents??null,source_url:product.sourceUrl,search_url:product.searchUrl,image_url:product.imageUrl??null,facts:product.facts,evidence:product.evidence,checked_at:product.verifiedAt}));return `Return a recommendation JSON object for this confirmed First Trip journey. The app has already completed its one-question-at-a-time interview. Required uncovered categories: ${JSON.stringify(activity.slots.filter(slot=>!r.coveredSlots.includes(slot)))}. First use CATALOG records where relevant. Then use live web search to find direct official REI or manufacturer product pages for every uncovered category missing from CATALOG, including the extra backpacking essentials. Include each product's slot. Do not use web search results, guides, blogs, marketplaces, or unverified images as product evidence. JOURNEY=${JSON.stringify({requirements:r,activity:{id:activity.id,name:activity.name},availability:"unknown; say Check availability on REI",catalog})}`;}

export async function POST(request:Request){
 const events:{label:string;detail:string}[]=[];
 try{
  const parsed=requestSchema.safeParse(await request.json());if(!parsed.success)return NextResponse.json({error:"Please enter a whole-dollar budget or leave it blank to continue without budget validation.",code:"INVALID_REQUIREMENTS",events},{status:400});
  const {runId,requirements}=parsed.data;const activity=getActivity(requirements.activityId);if(!activity)return NextResponse.json({error:"This activity is not configured.",events},{status:400});
  const catalog=await getProductCatalog();const token=(await cookies()).get("fta_session")?.value;let proposal:ReturnType<typeof fallback>=null;
  if(openAIAgentConfigured())try{
   const previous=token?await loadOpenAIAgentSession(token):null;const run=previous?await continueAgentJourney(previous,prompt(requirements,catalog)):await createAgentJourney(prompt(requirements,catalog));events.push(...run.events);if(token&&!previous){const saved=await saveOpenAIAgentSession(token,run.sessionId);events.push({label:"Session context",detail:saved?"Saved this agent session for edits and retries.":"Apply migration 202610170003 to persist the agent session."});}
   const output=parse(run.outputText);if(output?.type==="recommendation"&&Array.isArray(output.products)){const outputProducts=output.products as AgentProduct[];const external=webProducts(outputProducts,activity.id,catalog);const products=[...catalog,...external];const ids=outputProducts.map(product=>typeof product.id==="string"&&catalog.some(item=>item.id===product.id)?product.id:external.find(item=>item.slot===product.slot&&item.brand===product.brand&&item.name===product.name)?.id).filter((id):id is string=>Boolean(id));const validation=validate(products,requirements,ids);if(validation.status==="validated"){proposal={productIds:ids,reasons:Object.fromEntries(outputProducts.map(product=>{const id=typeof product.id==="string"&&catalog.some(item=>item.id===product.id)?product.id:external.find(item=>item.slot===product.slot&&item.brand===product.brand&&item.name===product.name)?.id;return [id||"",typeof product.why==="string"?product.why:"Selected from a direct source."]}).filter(([id])=>id)),validation};return await respond(proposal,products,events,runId,requirements,token);}events.push({label:"Research needs review",detail:"The agent found products but they did not cover every required category or fit the recorded budget."});}else events.push({label:"Research needs review",detail:"The agent did not return a complete sourced product list."});
  }catch(error){console.error("OpenAI Agents run failed",error);events.push({label:"Agent retry available",detail:"The live search did not finish. Existing source-backed records are shown where complete."});}
  else events.push({label:"Live agent not configured",detail:"Set OPENAI_AGENT_ID on the server to enable web product research."});
  proposal=fallback(catalog,requirements);if(!proposal)return NextResponse.json({error:"We could not yet find a complete set of direct-source products for this trip. Try again to continue web research, or adjust your answers.",code:"INCOMPLETE_SOURCED_SETUP",events},{status:422});return await respond(proposal,catalog,events,runId,requirements,token);
 }catch(error){console.error("First Trip agent request failed",error);return NextResponse.json({error:"We couldn’t complete the gear research. Your answers are saved; please retry in a moment.",events},{status:500});}
}
async function respond(proposal:NonNullable<ReturnType<typeof fallback>>,products:Product[],events:{label:string;detail:string}[],runId:string,requirements:Requirements,token:string|undefined){let persistence="local-only";if(supabaseConfigured&&token){await saveRun(token,{activityId:requirements.activityId,criteriaVersion:requirements.version,answers:requirements.answers,coverage:proposal.validation.coverage,status:"proposed",events,proposal});persistence="supabase";}return NextResponse.json({proposal:{items:proposal.productIds.map(id=>products.find(product=>product.id===id)).filter(Boolean),reasons:proposal.reasons,validation:proposal.validation},events,runId,persistence});}
