import "server-only";
import { catalog, type ActivityId, type Product, type Slot } from "@/lib/catalog";
import { readVerifiedProducts } from "@/lib/supabase-server";

type ProductRow={id:string;slot:Slot;activity_ids:ActivityId[];brand:string;name:string;price_cents:number|null;price_text:string|null;source_url:string;search_url:string;source_kind:Product["source"];checked_at:string;facts:string[];variant_id:string|null;variant_name:string|null;image_url:string|null;evidence:string};
function map(row:ProductRow):Product{return {id:row.id,slot:row.slot,activities:row.activity_ids,brand:row.brand,name:row.name,priceCents:row.price_cents??undefined,priceText:row.price_text??undefined,sourceUrl:row.source_url,searchUrl:row.search_url,source:row.source_kind,verifiedAt:row.checked_at.slice(0,10),facts:row.facts||[],variantId:row.variant_id??undefined,variantName:row.variant_name??undefined,imageUrl:row.image_url??undefined,evidence:row.evidence};}

/** Uses Supabase records when the migration has been applied; otherwise this reviewed vertical slice remains available. */
export async function getProductCatalog():Promise<Product[]>{
 const rows=await readVerifiedProducts() as ProductRow[]|null;
 // Supabase overrides matching reviewed records but never makes other reviewed records disappear.
 const stored=rows?.map(map)||[];
 return [...stored,...catalog.filter(seed=>!stored.some(record=>record.id===seed.id))];
}
