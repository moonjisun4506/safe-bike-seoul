import test from "node:test";
import assert from "node:assert/strict";
import { toKmaGrid, forecastIssue, selectForecast } from "../src/lib/weather.ts";
test("LCC grid reference and Seoul coordinates",()=>{
 assert.deepEqual(toKmaGrid(38,126),{nx:43,ny:136});
 assert.deepEqual(toKmaGrid(37.5665,126.978),{nx:60,ny:127});
 assert.deepEqual(toKmaGrid(37.5271,126.9328),{nx:59,ny:126});
 assert.throws(()=>toKmaGrid(NaN,127));
});
test("issuance handles publication margin and previous-day rollover in KST",()=>{
 assert.deepEqual(forecastIssue(new Date("2026-11-20T02:09:00+09:00")),{date:"20261119",time:"2300"});
 assert.deepEqual(forecastIssue(new Date("2026-11-20T02:10:00+09:00")),{date:"20261120",time:"0200"});
 assert.deepEqual(forecastIssue(new Date("2026-01-01T00:05:00+09:00")),{date:"20251231",time:"2300"});
});
const issue={date:"20261120",time:"1100"},grid={nx:59,ny:126};
const row=(category,time,value)=>({baseDate:issue.date,baseTime:issue.time,nx:59,ny:126,category,fcstDate:issue.date,fcstTime:time,fcstValue:value});
test("pairs TMP/POP for identical future forecast time, preserves zero and negative values",()=>{
 const items=[row("TMP","1100","12"),row("POP","1100","10"),row("TMP","1200","-2"),row("POP","1200","0")];
 const result=selectForecast(items,issue,grid,new Date("2026-11-20T11:25:00+09:00"));
 assert.equal(result.temperature,-2);assert.equal(result.precipitationProbability,0);
 assert.equal(result.issuedAt,"2026-11-20T11:00:00+09:00");assert.equal(result.forecastAt,"2026-11-20T12:00:00+09:00");
});
test("never combines different times, issuances, grids or missing values",()=>{
 for(const rows of [[row("TMP","1200","10"),row("POP","1300","20")],[row("TMP","1200","10"),{...row("POP","1200","20"),nx:60}],[row("TMP","1200","10"),{...row("POP","1200","20"),baseTime:"0800"}],[row("TMP","1200",""),row("POP","1200","20")]]){
 assert.throws(()=>selectForecast(rows,issue,grid,new Date("2026-11-20T11:25:00+09:00")));
 }
});
test("actual endpoint either returns validated official forecast or explicit failure without fake values",async()=>{
 const response=await fetch("http://127.0.0.1:3000/api/weather?lat=37.5271&lng=126.9328");const payload=await response.json();
 if(response.ok){assert.equal(payload.meta.source,"kma");assert.equal(payload.meta.isDemo,false);assert.deepEqual(payload.data.grid,{nx:59,ny:126});assert.ok(payload.data.precipitationProbability>=0&&payload.data.precipitationProbability<=100);assert.ok(Date.parse(payload.data.forecastAt)>=Date.parse(payload.data.issuedAt));console.log("Actual forecast:",JSON.stringify(payload.data));}
 else{assert.ok([502,503].includes(response.status));assert.ok(payload.error.code);assert.ok(!("data" in payload));console.log("Actual provider verification:",response.status,payload.error.code);}
});
