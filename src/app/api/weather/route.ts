import { getWeather } from "@/lib/server/weather";
import { ApiError, handle } from "@/lib/server/http";
import { toKmaGrid } from "@/lib/weather";
function coordinate(params:URLSearchParams,name:string,min:number,max:number){
  const raw=params.get(name);
  if(raw===null||!raw.trim()||!Number.isFinite(Number(raw))||Number(raw)<min||Number(raw)>max)throw new ApiError(400,"INVALID_PARAMETER","출발지 lat, lng 좌표를 올바르게 입력해 주세요.");
  return Number(raw);
}
export async function GET(request:Request){
  return handle(async()=>{
    const params=new URL(request.url).searchParams;
    const lat=coordinate(params,"lat",33,39),lng=coordinate(params,"lng",124,132);
    try{toKmaGrid(lat,lng);}catch{throw new ApiError(400,"INVALID_GRID","출발지가 기상청 예보 격자 범위를 벗어났습니다.");}
    const result=await getWeather(lat,lng);
    return Response.json(result,{headers:{"Cache-Control":"no-store","X-Content-Type-Options":"nosniff"}});
  });
}


// Deployment platform execution budget (seconds).
export const maxDuration = 30;
