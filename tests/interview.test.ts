import test from "node:test";
import assert from "node:assert/strict";
import { activities } from "../lib/activities";
import { interviewFor } from "../lib/interview";
import { createCoverage } from "../lib/coverage";

const backpackOnly=new Set(["backpack","shelter","bag","pad","water-treatment"]);
test("every activity has unique, relevant ownership choices",()=>{
 for(const activity of activities){
  const profile=interviewFor(activity.id);
  assert.ok(profile.ownership.length>=3,`${activity.id} needs ownership choices`);
  assert.equal(new Set(profile.ownership.map(x=>x.id)).size,profile.ownership.length,`${activity.id} has duplicate ownership choices`);
  if(activity.id!=="backpacking")assert.equal(profile.ownership.some(x=>backpackOnly.has(x.id)),false,`${activity.id} inherited backpacking gear`);
 }
});
test("running never shows overnight ownership defaults",()=>{
 const ownership=interviewFor("running").ownership.map(x=>x.id);
 assert.deepEqual(ownership,["running-shoes","phone-carry","hydration","visibility"]);
 const coverage=createCoverage("running").map(x=>x.needId);
 assert.deepEqual(coverage,ownership);
});
test("activity coverage respects the activity ownership list",()=>{
 for(const activity of activities){
  const owned=interviewFor(activity.id).ownership[0].id;
  const row=createCoverage(activity.id,[owned]).find(x=>x.needId===owned);
  assert.equal(row?.state,"owned",`${activity.id} should mark its own equipment covered`);
 }
});
