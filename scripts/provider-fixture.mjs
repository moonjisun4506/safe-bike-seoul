// Test-only preload for an isolated production server. Never enabled by the application.
const original=globalThis.fetch;
globalThis.fetch=async(input,options)=>{
 const url=new URL(typeof input==="string"?input:input instanceof URL?input.href:input.url);
 const scenario=process.env.QA_PROVIDER_CASE;
 if(!["openapi.seoul.go.kr","dapi.kakao.com","apis.data.go.kr"].includes(url.hostname))return original(input,options);
 const json=(data,status=200)=>Response.json(data,{status});
 if(scenario==="auth"){
  if(url.hostname==="openapi.seoul.go.kr")return json({RESULT:{CODE:"ERROR-100",MESSAGE:"test fixture rejected credential"}});
  return json({error:"test fixture forbidden"},403);
 }
 if(url.hostname==="openapi.seoul.go.kr"){
  if(scenario==="empty")return json({RESULT:{CODE:"INFO-200"}});
  return json({rentBikeStatus:{RESULT:{CODE:"INFO-000"},list_total_count:1,row:[{stationId:"QA-ST",stationName:"QA fixture only",parkingBikeTotCnt:"0",rackTotCnt:"10",stationLatitude:"37.5271",stationLongitude:"126.9328"}]}});
 }
 if(url.pathname.includes("routing/bicycle")){
  if(scenario==="route-auth")return json({},403);
  return json({status:"ZERO_RESULTS"});
 }
 if(url.pathname.includes("search/keyword"))return json({documents:[]});
 if(url.pathname.includes("frequentzoneBicycle"))return json({resultCode:"03",totalCount:0,items:{}});
 if(url.pathname.includes("getVilageFcst")){
  if(scenario==="partial")return json({response:{header:{resultCode:"00"},body:{items:{item:[{baseDate:url.searchParams.get("base_date"),baseTime:url.searchParams.get("base_time"),nx:Number(url.searchParams.get("nx")),ny:Number(url.searchParams.get("ny")),category:"TMP",fcstDate:"20990101",fcstTime:"1200",fcstValue:"1"}]}}}});
  return json({response:{header:{resultCode:"03"}}});
 }
 throw new Error("Unrecognized QA upstream");
};
