import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { randomUUID } from "crypto";
import { loadSession, supabaseConfigured } from "@/lib/supabase-server";

export async function GET(){
 const jar=await cookies(); let token=jar.get("fta_session")?.value;
 if(!token)token=randomUUID();
 const restored=await loadSession(token);
 const response=NextResponse.json({persistence:supabaseConfigured?"configured":"local-only",restored});
 if(!jar.get("fta_session")?.value)response.cookies.set("fta_session",token,{httpOnly:true,sameSite:"lax",secure:process.env.NODE_ENV==="production",path:"/",maxAge:86400});
 return response;
}

// A new visit is intentionally a new planning journey. Old rows remain only as
// short-lived server records and are not restored into the customer interface.
export async function POST(){
 const response=NextResponse.json({fresh:true});
 response.cookies.set("fta_session",randomUUID(),{httpOnly:true,sameSite:"lax",secure:process.env.NODE_ENV==="production",path:"/",maxAge:86400});
 return response;
}
