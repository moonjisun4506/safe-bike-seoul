import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import { writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import path from "node:path";
const results=[];
async function server(scenario,run){
 const fixture=scenario!=="live";
 const env={...process.env,API_DATA_MODE:"live",...(fixture?{SEOUL_API_KEY:"qa-dummy-not-a-real-key",KAKAO_REST_API_KEY:"qa-dummy-not-a-real-key",DATA_GO_KR_API_KEY:"qa-dummy-not-a-real-key",KMA_SERVICE_KEY:"qa-dummy-not-a-real-key",QA_PROVIDER_CASE:scenario}:{})};
 const args=[...(fixture?["--import",pathToFileURL(path.resolve("scripts/provider-fixture.mjs")).href]:[]),"node_modules/next/dist/bin/next","start","--hostname","127.0.0.1","--port","3102"];
 const child=spawn(process.execPath,args,{env,stdio:"ignore",windowsHide:true});let exited=false;child.on("exit",()=>{exited=true;});
 try{
  let ready=false;for(let i=0;i<60;i++){if(exited)throw new Error("QA server failed to start");try{if((await fetch("http://127.0.0.1:3102")).ok){ready=true;break;}}catch{}await delay(200);}assert.ok(ready);
  const get=async(endpoint)=>{const r=await fetch(`http://127.0.0.1:3102/api/${endpoint}`);return {status:r.status,body:await r.json()};};
  await run(get);console.log("PASS:",fixture?`injected upstream ${scenario}`:"actual live provider responses");results.push({scenario,type:fixture?"injected-upstream":"actual-provider",result:"passed"});
 }finally{child.kill();if(!exited)await new Promise(resolve=>child.once("exit",resolve));}
}
try{
 await server("live",async get=>{
  const places=await get("places?query="+encodeURIComponent("여의나루역"));assert.equal(places.status,200);assert.equal(places.body.meta.source,"kakao");assert.ok(places.body.data.length);
  const empty=await get("places?query=zzqvxx-no-place-628475");assert.equal(empty.status,200);assert.deepEqual(empty.body.data,[]);
  const stations=await get("stations?lat=37.5271&lng=126.9328&limit=1");assert.equal(stations.status,200);assert.equal(stations.body.meta.source,"seoul");
  const routes=await get(`routes?stationId=${stations.body.data[0].id}&endLat=37.5097&endLng=126.9959`);assert.equal(routes.status,200);assert.equal(routes.body.data.routes.length,2);
  const accidents=await get("accidents");assert.equal(accidents.status,200);assert.ok(accidents.body.data.length);
  const weather=await get("weather?lat=37.5271&lng=126.9328");assert.equal(weather.status,200);assert.equal(weather.body.meta.source,"kma");
  console.log(`Live: places ${places.body.data.length}, stations ${stations.body.meta.totalStations}, routes ${routes.body.data.routes.length}, accident zones ${accidents.body.data.length}, forecast ${weather.body.data.forecastAt}`);
 });
 await server("auth",async get=>{
  for(const endpoint of ["places?query=test","stations?lat=37.5&lng=127","accidents","weather?lat=37.5&lng=127"]){const r=await get(endpoint);assert.equal(r.status,502);assert.ok(!("data" in r.body));assert.ok(/AUTH|DENIED/.test(r.body.error.code));assert.ok(!JSON.stringify(r.body).includes("qa-dummy"));}
 });
 await server("empty",async get=>{
  const s=await get("stations?lat=37.5&lng=127");assert.equal(s.status,200);assert.deepEqual(s.body.data,[]);
  const a=await get("accidents");assert.equal(a.status,502);assert.equal(a.body.error.code,"ACCIDENT_NO_DATA");
  const w=await get("weather?lat=37.5&lng=127");assert.equal(w.status,503);assert.equal(w.body.error.code,"WEATHER_NOT_PUBLISHED");
 });
 await server("route-auth",async get=>{const r=await get("routes?stationId=QA-ST&endLat=37.5097&endLng=126.9959");assert.equal(r.status,502);assert.equal(r.body.error.code,"KAKAO_PERMISSION_DENIED");assert.ok(!("data" in r.body));});
 await server("no-route",async get=>{const r=await get("routes?stationId=QA-ST&endLat=37.5097&endLng=126.9959");assert.equal(r.status,502);assert.equal(r.body.error.code,"KAKAO_NO_ROUTE");});
 await server("partial",async get=>{const r=await get("weather?lat=37.5&lng=127");assert.equal(r.status,502);assert.equal(r.body.error.code,"WEATHER_INCOMPLETE");assert.ok(!("data" in r.body));});
}finally{await writeFile("artifacts/provider-test-results.json",JSON.stringify(results,null,2));}
