import { readFile } from "node:fs/promises";
import { extname, resolve } from "node:path";

type RecordInput={id:string;slot:"backpack"|"shelter"|"bag"|"pad";activity_ids:string[]|string;brand:string;name:string;price_cents?:number|string|null;price_text?:string|null;source_url:string;search_url:string;source_kind:"REI listing"|"REI product page"|"Manufacturer";checked_at:string;facts?:string[]|string;variant_id?:string|null;variant_name?:string|null;image_url?:string|null;evidence:string};
const required=["id","slot","activity_ids","brand","name","source_url","search_url","source_kind","checked_at","evidence"] as const;
function csv(text:string){const lines=text.trim().split(/\r?\n/);const headers=lines.shift()?.split(",").map(x=>x.trim())||[];return lines.filter(Boolean).map(line=>{const cells:string[]=[];let cell="",quoted=false;for(let i=0;i<line.length;i++){const ch=line[i];if(ch==='"')quoted=!quoted;else if(ch===","&&!quoted){cells.push(cell.trim());cell="";}else cell+=ch;}cells.push(cell.trim());return Object.fromEntries(headers.map((h,i)=>[h,cells[i]||""]));});}
function array(value:unknown){if(Array.isArray(value))return value.map(String);if(typeof value!=="string")return [];try{const parsed=JSON.parse(value);return Array.isArray(parsed)?parsed.map(String):value.split("|").filter(Boolean);}catch{return value.split("|").filter(Boolean);}}
function normalize(input:RecordInput){for(const key of required)if(!input[key])throw new Error(`Missing required field: ${key}`);for(const key of ["source_url","search_url"] as const)if(!/^https:\/\//.test(input[key]))throw new Error(`${key} must be an HTTPS URL`);const price=input.price_cents===""||input.price_cents==null?null:Number(input.price_cents);if(price!==null&&(!Number.isInteger(price)||price<0))throw new Error(`price_cents must be a non-negative integer for ${input.id}`);return {...input,activity_ids:array(input.activity_ids),facts:array(input.facts),price_cents:price||null,price_text:input.price_text||null,variant_id:input.variant_id||null,variant_name:input.variant_name||null,image_url:input.image_url||null};}

const inputPath=process.argv[2];
if(!inputPath)throw new Error("Usage: npx tsx scripts/import-verified-products.ts <catalog.json|catalog.csv>");
const raw=await readFile(resolve(inputPath),"utf8");
const rows=(extname(inputPath).toLowerCase()===".json"?JSON.parse(raw):csv(raw)) as RecordInput[];
if(!Array.isArray(rows)||!rows.length)throw new Error("Import must contain a non-empty array or CSV rows.");
const records=rows.map(normalize);
const url=process.env.SUPABASE_URL,key=process.env.SUPABASE_SECRET_KEY;
if(!url||!key)throw new Error("SUPABASE_URL and SUPABASE_SECRET_KEY must be set in .env.local.");
const response=await fetch(`${url}/rest/v1/outfitter_products?on_conflict=id`,{method:"POST",headers:{apikey:key,"Content-Type":"application/json",Prefer:"resolution=merge-duplicates,return=minimal"},body:JSON.stringify(records)});
if(!response.ok)throw new Error(`Supabase import failed: ${response.status} ${await response.text()}`);
console.log(`Imported ${records.length} verified product record(s).`);
