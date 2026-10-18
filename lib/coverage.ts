import type {ActivityId, Slot} from "./catalog";
import { interviewFor } from "./interview";

export type CoverageState="needs_product"|"recommended"|"owned"|"borrowing"|"renting"|"optional_deferred"|"not_applicable"|"needs_confirmation"|"no_verified_match";
export type CoverageRow={needId:string;category:string;purpose:string;classification:"essential"|"conditional"|"optional";sourceId:string;quantity:number;state:CoverageState;reason?:string;slot?:Slot};
const source:Record<ActivityId,string>={camping:"REI Camping for Beginners",backpacking:"REI Backpacking for Beginners",hiking:"REI Hiking Expert Advice",running:"REI Trail Running Checklist",cycling:"REI Cycling Expert Advice",climbing:"REI Climbing Expert Advice",paddling:"REI Watersports Expert Advice",snow:"REI Snowsports Expert Advice"};
const sourceBackedNeeds=new Set(["backpack","shelter","bag","pad","tent","sleeping-bag","sleeping-pad","running-shoes","hydration"]);
export function createCoverage(activityId:ActivityId,covered:string[]=[]):CoverageRow[]{
 const activitySource=source[activityId];
 const gear:CoverageRow[]=interviewFor(activityId).ownership.map(option=>({needId:option.id,category:option.label,purpose:`Confirm whether ${option.label.toLowerCase()} is owned, borrowed, rented, or needed.`,classification:"essential",sourceId:activitySource,quantity:1,state:covered.includes(option.id)?"owned":sourceBackedNeeds.has(option.id)?"needs_product":"no_verified_match",reason:sourceBackedNeeds.has(option.id)?undefined:"Catalog coverage is not available for this category yet."}));
 if(activityId==="backpacking")gear.push({needId:"clothing",category:"Clothing and footwear",purpose:"Layering and footwear remain context-dependent",classification:"essential",sourceId:activitySource,quantity:1,state:"needs_confirmation",reason:"No verified apparel or footwear catalog is seeded."});
 if(activityId==="camping")gear.push({needId:"conditions",category:"Conditions and campsite amenities",purpose:"Campsite services and conditions affect supporting gear.",classification:"conditional",sourceId:activitySource,quantity:1,state:"needs_confirmation"});
 return gear;
}
export function coverageGaps(rows:CoverageRow[]){return rows.filter(x=>x.classification!=="optional"&&!["owned","borrowing","renting","recommended","not_applicable"].includes(x.state));}
