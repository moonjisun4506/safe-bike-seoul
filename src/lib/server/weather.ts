import "server-only";
import { serverEnv } from "./env";
import { ApiError, list, object, requireKey } from "./http";
import { forecastIssue, selectForecast, toKmaGrid, type ForecastIssue } from "../weather";
const cached=new Map<string,{items:unknown[];expires:number;fetchedAt:string}>();
async function load(issue:ForecastIssue,grid:{nx:number;ny:number}){
  const cacheKey=`${issue.date}:${issue.time}:${grid.nx}:${grid.ny}`;
  const entry=cached.get(cacheKey);if(entry&&entry.expires>Date.now())return entry;
  let key=requireKey(serverEnv.weatherKey);try{key=decodeURIComponent(key);}catch{/* raw */}
  const url=new URL("https://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/getVilageFcst");
  url.search=new URLSearchParams({serviceKey:key,pageNo:"1",numOfRows:"1000",dataType:"JSON",base_date:issue.date,base_time:issue.time,nx:String(grid.nx),ny:String(grid.ny)}).toString();
  let payload:Record<string,unknown>;
  let response:Response;
  try{response=await fetch(url,{cache:"no-store",redirect:"error",signal:AbortSignal.timeout(8000)});}catch{throw new ApiError(502,"WEATHER_NETWORK_ERROR","기상청 단기예보 연결 실패 또는 응답 시간 초과입니다. 잠시 후 다시 시도해 주세요.");}
  if(response.status===401||response.status===403)throw new ApiError(502,"WEATHER_ACCESS_DENIED",`기상청 단기예보 접근이 거부되었습니다(HTTP ${response.status}). 공공데이터포털의 해당 서비스 활용승인과 서버 인증키·접근 제한을 확인해 주세요. 정확한 거부 사유는 응답만으로 확인되지 않았습니다.`);
  if(response.status===429)throw new ApiError(503,"WEATHER_QUOTA_EXCEEDED","기상청 API 호출 한도를 초과했습니다. 잠시 후 다시 시도해 주세요.");
  if(!response.ok)throw new ApiError(502,"WEATHER_UPSTREAM_ERROR",`기상청 API가 HTTP ${response.status}를 반환했습니다. 임의 날씨는 표시하지 않습니다.`);
  try{payload=object(object(await response.json()).response);}catch{throw new ApiError(502,"WEATHER_RESPONSE_ERROR","기상청 응답이 정상 JSON 형식이 아닙니다. API 활용승인과 인증키를 확인해 주세요.");}
  const code=String(object(payload.header).resultCode);
  if(code==="03")return null; // New issuance not yet available; try the preceding official issuance.
  if(code!=="00")throw new ApiError(502,"WEATHER_PROVIDER_ERROR","기상청 API가 정상 예보를 반환하지 않았습니다. 서버 인증키와 단기예보 서비스 활용승인을 확인해 주세요.");
  const result={items:list(object(object(payload.body).items).item),expires:Date.now()+10*60000,fetchedAt:new Date().toISOString()};
  if(cached.size>=100)cached.delete(cached.keys().next().value!);
  cached.set(cacheKey,result);return result;
}
export async function getWeather(lat:number,lng:number){
  const grid=toKmaGrid(lat,lng),now=new Date();
  for(let retry=0;retry<2;retry++){
    const issue=forecastIssue(new Date(now.getTime()-retry*3*3600000));
    const result=await load(issue,grid);if(!result)continue;
    try{return {data:selectForecast(result.items,issue,grid,now),meta:{source:"kma",isDemo:false,fetchedAt:result.fetchedAt,timezone:"Asia/Seoul",cacheSeconds:600,previousIssuance:retry>0}};}
    catch{throw new ApiError(502,"WEATHER_INCOMPLETE","동일한 예보시각의 기온·강수확률을 찾지 못했습니다. 임의 날씨는 표시하지 않습니다.");}
  }
  throw new ApiError(503,"WEATHER_NOT_PUBLISHED","기상청의 최신 및 이전 발표 자료가 아직 제공되지 않습니다. 잠시 후 다시 시도해 주세요.");
}


