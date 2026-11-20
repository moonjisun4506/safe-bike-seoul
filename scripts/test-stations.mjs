import test from "node:test";
import assert from "node:assert/strict";
import { distanceMeters, nearbyStations } from "../src/lib/stations.ts";
const fixture = [
 { id:"far", name:"far", lat:37.53,lng:127,bikes:0,racks:10 },
 { id:"near", name:"near", lat:37.5001,lng:127,bikes:3,racks:10 },
 { id:"outside", name:"outside", lat:37.7,lng:127,bikes:7,racks:10 },
];
test("distance is zero at the origin and about 111m per .001 latitude",()=>{
 assert.equal(distanceMeters(37.5,127,37.5,127),0);
 assert.ok(Math.abs(distanceMeters(37.5,127,37.501,127)-111.2)<1);
});
test("nearby search filters by radius, ranks distances, preserves zero-bike stations",()=>{
 const result=nearbyStations(fixture,37.5,127,5000,20);
 assert.deepEqual(result.map(s=>s.id),["near","far"]);
 assert.equal(result[1].bikes,0);
 assert.equal(nearbyStations(fixture,37.5,127,5000,1)[0].id,"near");
 assert.deepEqual(nearbyStations(fixture,37.1,127,100,20),[]);
});
test("live endpoint returns real sorted stations and refreshes distances for a new origin",async()=>{
 for(const [lat,lng] of [[37.5271,126.9328],[37.5097,126.9959]]){
  const response=await fetch(`http://127.0.0.1:3000/api/stations?lat=${lat}&lng=${lng}&radius=2000&limit=20`);
  assert.equal(response.status,200);
  const p=await response.json();
  assert.equal(p.meta.source,"seoul");assert.equal(p.meta.isDemo,false);
  assert.ok(p.meta.totalStations>1000);assert.ok(p.data.length>0);assert.ok(p.data.length<=20);
  for(let i=0;i<p.data.length;i++){
   const s=p.data[i];assert.ok(s.id);assert.ok(Number.isInteger(s.bikes)&&s.bikes>=0);
   assert.ok(Math.abs(s.distanceMeters-distanceMeters(lat,lng,s.lat,s.lng))<=1);
   assert.ok(s.distanceMeters<=2000);
   if(i)assert.ok(p.data[i-1].distanceMeters<=s.distanceMeters);
  }
 }
});
