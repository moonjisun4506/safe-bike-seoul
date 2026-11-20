import "server-only";
import { serverEnv } from "./env";
import { ApiError, fetchJson, numeric, object } from "./http";
import { ACCIDENT_SOURCE_URL, DOCUMENTED_LATEST_ACCIDENT_YEAR, parseAccidentZone, type AccidentSnapshot, type AccidentZone } from "../accidents";
const districts=["110","140","170","200","215","230","260","290","305","320","350","380","410","440","470","500","530","545","560","590","620","650","680","710","740"];
let cached: {snapshot:AccidentSnapshot;expires:number}|undefined;
let pending:Promise<AccidentSnapshot>|undefined;
async function district(year:number,guGun:string,key:string):Promise<AccidentZone[]> {
  const records:unknown[]=[];
  for(let pageNo=1;pageNo<=100;pageNo++){
    const url=new URL("https://apis.data.go.kr/B552061/frequentzoneBicycle/getRestFrequentzoneBicycle");
    let decoded=key;try{decoded=decodeURIComponent(key);}catch{/* raw */}
    url.search=new URLSearchParams({ServiceKey:decoded,searchYearCd:String(year),siDo:"11",guGun,type:"json",numOfRows:"100",pageNo:String(pageNo)}).toString();
    let root:Record<string,unknown>;
    try{root=object(await fetchJson(url));}catch(error){if(error instanceof ApiError)throw error;throw new ApiError(502,"ACCIDENT_UPSTREAM_ERROR","공공데이터포털 사고 API 조회가 실패했습니다. 인증키·활용승인·네트워크를 확인해 주세요. 사고지역이 없다는 뜻이 아닙니다.");}
    const code=String(root.resultCode);
    if(code==="03")break;
    if(code!=="00")throw new ApiError(502,"ACCIDENT_PROVIDER_ERROR","사고 API가 정상 데이터를 반환하지 않았습니다. 인증키와 해당 서비스 활용승인을 확인해 주세요. 사고지역이 없다는 뜻이 아닙니다.");
    const total=numeric(root.totalCount);
    if(!Number.isInteger(total)||total<0||total>10000)throw new Error("Invalid total");
    const raw=root.items&&typeof root.items==="object"?object(root.items).item:undefined;
    const items=Array.isArray(raw)?raw:raw&&typeof raw==="object"?[raw]:[];
    if(!items.length&&records.length<total)throw new Error("Incomplete accident page");
    records.push(...items);
    if(records.length>=total)break;
    if(pageNo===100)throw new Error("Accident page limit");
  }
  return records.map(row=>parseAccidentZone(row,year));
}
async function load():Promise<AccidentSnapshot>{
  const key=serverEnv.publicDataKey;
  if(!key)throw new ApiError(503,"ACCIDENT_KEY_MISSING","공공데이터포털 인증키(DATA_GO_KR_API_KEY)가 설정되지 않아 사고정보를 조회할 수 없습니다. 해당 서비스 활용신청 후 서버 .env에 키를 입력해 주세요. 사고지역이 없다는 뜻이 아닙니다.");
  const checkedYears:number[]=[];
  for(let year=DOCUMENTED_LATEST_ACCIDENT_YEAR;year>=2012;year--){
    checkedYears.push(year);
    const data:AccidentZone[]=[];
    // Bounded concurrency; accept a year only after all Seoul districts succeed.
    for(let i=0;i<districts.length;i+=5){
      const parts=await Promise.all(districts.slice(i,i+5).map(guGun=>district(year,guGun,key)));
      parts.forEach(part=>data.push(...part));
    }
    if(data.length){
      const snapshot:AccidentSnapshot={data:[...new Map(data.map(zone=>[zone.id,zone])).values()],meta:{source:"koroad",isDemo:false,year,documentedLatestYear:DOCUMENTED_LATEST_ACCIDENT_YEAR,fetchedAt:new Date().toISOString(),sourceUrl:ACCIDENT_SOURCE_URL,checkedYears,warning:`${year}년 발생 사고 기반 과거 통계입니다. 실시간 사고·현재 위험도 정보가 아닙니다.`}};
      cached={snapshot,expires:Date.now()+24*3600000};return snapshot;
    }
  }
  throw new ApiError(502,"ACCIDENT_NO_DATA","공식 제공기간에서 서울 사고다발지역 자료를 찾지 못했습니다. 현재 사고가 없다는 뜻은 아닙니다.");
}
export async function getAccidents(){
  if(cached&&cached.expires>Date.now())return cached.snapshot;
  if(!pending)pending=load().finally(()=>{pending=undefined;});
  return pending;
}

