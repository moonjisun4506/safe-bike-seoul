import test from "node:test";
import assert from "node:assert/strict";
import { parseCyclingRoute } from "../src/lib/cycling-route.ts";
const valid={status:"OK",route:{properties:{totalDistance:120,totalTime:60},legs:[{steps:[{path:{points:[[127,37.5],[127.001,37.501]]}},{path:{points:[[127.002,37.502],[127.003,37.503]]}}]}]}};
test("preserves official sections without inventing connectors",()=>{
 const r=parseCyclingRoute(valid,"BIKE_ONLY");
 assert.equal(r.distance,120);assert.equal(r.duration,60);assert.equal(r.paths.length,2);
 assert.deepEqual(r.paths[0][0],{lng:127,lat:37.5});
});
test("rejects failed, missing, empty and invalid geometry",()=>{
 for(const p of [{status:"ERROR"},{...valid,route:{...valid.route,legs:[]}},{...valid,route:{...valid.route,properties:{totalDistance:-1,totalTime:60}}}])assert.throws(()=>parseCyclingRoute(p,"SHORTEST"));
});
test("actual selected station to destination returns both official routes",async()=>{
 const stationResponse=await fetch("http://127.0.0.1:3000/api/stations?lat=37.5271&lng=126.9328&limit=1");
 assert.equal(stationResponse.status,200);
 const station=(await stationResponse.json()).data[0];
 const response=await fetch(`http://127.0.0.1:3000/api/routes?stationId=${station.id}&endLat=37.5097&endLng=126.9959`);
 assert.equal(response.status,200);
 const p=await response.json();assert.equal(p.meta.isDemo,false);assert.equal(p.meta.source,"kakao");assert.equal(p.data.origin.id,station.id);
 assert.deepEqual(p.data.routes.map(r=>r.mode),["BIKE_ONLY","SHORTEST"]);
 for(const route of p.data.routes){assert.ok(route.distance>0);assert.ok(route.duration>0);assert.ok(route.paths.flat().length>2);}
 console.log(p.data.routes.map(r=>`${r.mode}: ${r.distance}m, ${r.duration}s, ${r.paths.flat().length} points`).join("; "));
});
