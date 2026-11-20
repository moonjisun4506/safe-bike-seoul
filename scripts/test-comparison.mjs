import test from "node:test";
import assert from "node:assert/strict";
import { compareRouteZones } from "../src/lib/accidents.ts";
const zone={id:"zone-1",name:"test fixture",year:2025,lat:37.5,lng:127,accidents:4,casualties:4,deaths:0,rings:[]};
const routes=[{mode:"BIKE_ONLY",distance:1000,duration:400,paths:[[{lat:37.5,lng:126.99},{lat:37.5,lng:127.01}]]},{mode:"SHORTEST",distance:900,duration:350,paths:[[{lat:37.52,lng:126.99},{lat:37.52,lng:127.01}]]}];
test("compares each official route independently without ranking safety",()=>{
 const result=compareRouteZones(routes,[zone,zone]);
 assert.deepEqual(result,[{mode:"BIKE_ONLY",distance:1000,duration:400,zoneCount:1},{mode:"SHORTEST",distance:900,duration:350,zoneCount:0}]);
});
test("unavailable accident data is unknown rather than zero",()=>{
 assert.ok(compareRouteZones(routes,null).every(r=>r.zoneCount===null));
 assert.ok(compareRouteZones(routes,[]).every(r=>r.zoneCount===0));
});
test("current data services preserve individual provenance and forecast timestamps",async()=>{
 const stations=await(await fetch("http://127.0.0.1:3000/api/stations?lat=37.5271&lng=126.9328&limit=1")).json();
 assert.ok(stations.meta.fetchedAt);assert.equal(stations.meta.source,"seoul");
 const [routing,accidents,weather]=await Promise.all([
 fetch(`http://127.0.0.1:3000/api/routes?stationId=${stations.data[0].id}&endLat=37.5097&endLng=126.9959`).then(r=>r.json()),
 fetch("http://127.0.0.1:3000/api/accidents").then(r=>r.json()),
 fetch("http://127.0.0.1:3000/api/weather?lat=37.5271&lng=126.9328").then(r=>r.json())]);
 for(const p of [routing,accidents,weather]){assert.ok(p.meta.fetchedAt);assert.equal(p.meta.isDemo,false);}
 assert.equal(routing.meta.source,"kakao");assert.equal(accidents.meta.source,"koroad");assert.equal(weather.meta.source,"kma");
 assert.ok(accidents.meta.year);assert.ok(weather.data.issuedAt);assert.ok(weather.data.forecastAt);
 const result=compareRouteZones(routing.data.routes,accidents.data);assert.equal(result.length,2);
 console.log(result.map(r=>`${r.mode}: ${r.distance}m, ${r.zoneCount} historical zones`).join("; "));
});
