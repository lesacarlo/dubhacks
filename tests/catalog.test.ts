import test from "node:test";
import assert from "node:assert/strict";
import { catalog } from "../lib/catalog";

test("vertical-slice records retain source and REI search links",()=>{
 assert.equal(catalog.length,6);
 for(const product of catalog){
  assert.equal(product.source,"REI listing");
  assert.match(product.sourceUrl,/^https:\/\/www\.rei\.com\//);
  assert.match(product.searchUrl,/^https:\/\/www\.rei\.com\/search\?/);
  assert.ok(product.verifiedAt);
  assert.notEqual(product.priceCents,undefined);
 }
 assert.ok(catalog.some(product=>product.activities.includes("running")&&product.slot==="running-shoes"));
});
