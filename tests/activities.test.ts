import test from "node:test";
import assert from "node:assert/strict";
import { activities, coverageLabel } from "../lib/activities";

test("all requested activity families have a truthful entry point",()=>{
  assert.deepEqual(activities.map(x=>x.id),["camping","backpacking","hiking","running","cycling","climbing","paddling","snow"]);
  for(const activity of activities){assert.ok(activity.guide.url.startsWith("https://www.rei.com/"));assert.ok(activity.scope.length>20);}
});
test("coverage names distinguish complete and limited paths",()=>{
  assert.equal(coverageLabel("guided"),"Guided setup");
  assert.equal(coverageLabel("discovery"),"Product discovery");
  assert.equal(coverageLabel("guide"),"Guide only");
});
