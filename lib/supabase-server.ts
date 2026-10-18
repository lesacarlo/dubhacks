import "server-only";
import { createHash } from "crypto";

const url=process.env.SUPABASE_URL;
const key=process.env.SUPABASE_SECRET_KEY;
export const supabaseConfigured=Boolean(url&&key&&process.env.SESSION_SECRET);
// Supabase's current sb_secret keys are sent as apikey, not as a JWT Bearer token.
const headers={apikey:key||"","Content-Type":"application/json"};
const tokenHash=(token:string)=>createHash("sha256").update(`${process.env.SESSION_SECRET}:${token}`).digest("hex");

export async function rest(path:string,init:RequestInit){
 if(!supabaseConfigured) return null;
 const response=await fetch(`${url}/rest/v1/${path}`,{...init,headers:{...headers,...init.headers},cache:"no-store"});
 if(!response.ok) throw new Error("Supabase persistence request failed.");
 return response.headers.get("content-type")?.includes("application/json")?response.json():null;
}

export async function readVerifiedProducts(){
 if(!supabaseConfigured)return null;
 try{return await rest("outfitter_products?select=*&order=checked_at.desc",{method:"GET"})}catch{return null;}
}

export async function saveRun(token:string,input:{activityId:string;criteriaVersion:number;answers:Record<string,string>;coverage:unknown;status:string;events:unknown;proposal?:unknown}){
 if(!supabaseConfigured) return false;
 const sessions=await rest("outfitter_sessions?on_conflict=session_token_hash",{method:"POST",headers:{Prefer:"resolution=merge-duplicates,return=representation"},body:JSON.stringify({session_token_hash:tokenHash(token),activity_id:input.activityId,criteria_version:input.criteriaVersion,answers:input.answers,coverage_ledger:input.coverage,updated_at:new Date().toISOString(),expires_at:new Date(Date.now()+86400000).toISOString()})}) as Array<{id:string}>;
 const sessionId=sessions?.[0]?.id; if(!sessionId)throw new Error("Supabase session persistence returned no session.");
 await rest("outfitter_runs",{method:"POST",headers:{Prefer:"return=minimal"},body:JSON.stringify({session_id:sessionId,status:input.status,events:input.events,proposal:input.proposal||null,expires_at:new Date(Date.now()+86400000).toISOString()})});
 return true;
}

export async function loadSession(token:string){
 if(!supabaseConfigured)return null;
 try{
  const rows=await rest(`outfitter_sessions?session_token_hash=eq.${encodeURIComponent(tokenHash(token))}&select=activity_id,answers,coverage_ledger&limit=1`,{method:"GET"}) as Array<{activity_id:string;answers:Record<string,string>;coverage_ledger:Array<{needId:string;state:string}>}>;
  const row=rows?.[0]; if(!row)return null;
  return {activityId:row.activity_id,answers:row.answers||{},coveredSlots:(row.coverage_ledger||[]).filter(item=>item.state==="owned"||item.state==="borrowing").map(item=>item.needId)};
 }catch{return null;}
}

export async function loadOpenAIAgentSession(token:string){
 if(!supabaseConfigured)return null;
 try{const rows=await rest(`outfitter_sessions?session_token_hash=eq.${encodeURIComponent(tokenHash(token))}&select=openai_agent_session_id&limit=1`,{method:"GET"}) as Array<{openai_agent_session_id?:string}>;return rows?.[0]?.openai_agent_session_id||null;}catch{return null;}
}
export async function saveOpenAIAgentSession(token:string,openaiSessionId:string){
 if(!supabaseConfigured)return false;
 try{const now=new Date().toISOString();await rest("outfitter_sessions?on_conflict=session_token_hash",{method:"POST",headers:{Prefer:"resolution=merge-duplicates,return=minimal"},body:JSON.stringify({session_token_hash:tokenHash(token),openai_agent_id:process.env.OPENAI_AGENT_ID||null,openai_agent_session_id:openaiSessionId,openai_agent_session_updated_at:now,updated_at:now,expires_at:new Date(Date.now()+86400000).toISOString()})});return true;}catch{return false;}
}
