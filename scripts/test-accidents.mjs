import assert from "node:assert/strict";
import test from "node:test";
import { parseAccidentZone, routeDistance, zonesNearRoute } from "../src/lib/accidents.ts";
const record={afos_fid:1,spot_nm:"test fixture",la_crd:"37.5",lo_crd:"127",occrrnc_cnt:4,caslt_cnt:5,dth_dnv_cnt:0,geom_json:'{"type":"Polygon","coordinates":[[[127,37.5],[127.001,37.5],[127.001,37.501],[127,37.5]]]}'};
test("normalizes provider coordinates, counts and actual year",()=>{
 const zone=parseAccidentZone(record,2025);assert.equal(zone.year,2025);assert.equal(zone.accidents,4);assert.equal(zone.rings[0].length,4);assert.equal(zone.lat,37.5);
 assert.throws(()=>parseAccidentZone({...record,la_crd:"0"},2025));
});
test("uses segment distance rather than just vertices",()=>{
 const p={lat:37.5,lng:127};
 assert.ok(routeDistance(p,[[{lat:37.5,lng:126.99},{lat:37.5,lng:127.01}]])<1);
 const d=routeDistance(p,[[{lat:37.501,lng:126.99},{lat:37.501,lng:127.01}]]);assert.ok(d>110&&d<112);
 assert.equal(routeDistance(p,[]),null);
});
test("does not invent a line between separate route sections",()=>{
 const zone=parseAccidentZone(record,2025);
 const paths=[[{lat:37.5,lng:126.98},{lat:37.5,lng:126.99}],[{lat:37.5,lng:127.01},{lat:37.5,lng:127.02}]];
 assert.ok(routeDistance(zone,paths)>800);assert.deepEqual(zonesNearRoute([zone],paths,300),[]);
});
test("real API returns Seoul zones for the latest documented year",async()=>{
 const response=await fetch("http://127.0.0.1:3000/api/accidents");assert.equal(response.status,200);
 const payload=await response.json();assert.equal(payload.meta.year,2025);assert.equal(payload.meta.isDemo,false);assert.equal(payload.meta.source,"koroad");assert.ok(payload.data.length>0);
 assert.ok(payload.data.every(a=>a.year===2025&&a.lat>37&&a.lng>126));
 const stations=await (await fetch("http://127.0.0.1:3000/api/stations?lat=37.5271&lng=126.9328&limit=1")).json();
 const routes=await (await fetch(`http://127.0.0.1:3000/api/routes?stationId=${stations.data[0].id}&endLat=37.5097&endLng=126.9959`)).json();
 for(const route of routes.data.routes){const near=zonesNearRoute(payload.data,route.paths);assert.ok(near.every(a=>a.distanceMeters<=300));console.log(`${route.mode}: ${near.length} historical zones within 300m`);}
 console.log(`Actual accident year: ${payload.meta.year}; Seoul zones: ${payload.data.length}; polygons: ${payload.data.filter(a=>a.rings.length).length}`);
});
