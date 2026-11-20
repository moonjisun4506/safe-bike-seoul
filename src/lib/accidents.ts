export const DOCUMENTED_LATEST_ACCIDENT_YEAR = 2025;
export const ACCIDENT_SOURCE_URL = "https://opendata.koroad.or.kr/api/selectBicycleDataSet.do";
export type AccidentZone = { id: string; name: string; year: number; lat: number; lng: number; accidents: number; casualties: number; deaths: number; rings: {lat:number;lng:number}[][] };
export type AccidentSnapshot = { data: AccidentZone[]; meta: { source: string; isDemo: false; year: number; documentedLatestYear: number; fetchedAt: string; sourceUrl: string; warning: string; checkedYears: number[] } };
type Point = {lat:number;lng:number};
export function routeDistance(point: Point, paths: Point[][]): number | null {
  let best = Infinity;
  const scale = Math.PI / 180 * 6371000;
  const xy = (p: Point) => ({x:(p.lng-point.lng)*scale*Math.cos(point.lat*Math.PI/180), y:(p.lat-point.lat)*scale});
  for (const path of paths) for(let i=1;i<path.length;i++) {
    const a=xy(path[i-1]), b=xy(path[i]);
    const dx=b.x-a.x, dy=b.y-a.y, length=dx*dx+dy*dy;
    const t=length ? Math.max(0,Math.min(1,-(a.x*dx+a.y*dy)/length)) : 0;
    best=Math.min(best,Math.hypot(a.x+t*dx,a.y+t*dy));
  }
  return Number.isFinite(best) ? best : null;
}
export function zonesNearRoute(zones: AccidentZone[], paths: Point[][], threshold=300) {
  return zones.map(zone => ({...zone,distanceMeters:routeDistance(zone,paths)}))
    .filter((zone): zone is AccidentZone & {distanceMeters:number} => zone.distanceMeters !== null && zone.distanceMeters<=threshold)
    .sort((a,b)=>a.distanceMeters-b.distanceMeters);
}
export function parseAccidentZone(value: unknown, year: number): AccidentZone {
  if(!value || typeof value!=="object")throw new Error("Invalid accident record");
  const s=value as Record<string,unknown>;
  const number=(v:unknown)=>{if((typeof v!=="number"&&typeof v!=="string")||v===""||!Number.isFinite(Number(v)))throw new Error("Invalid accident number");return Number(v);};
  const lat=number(s.la_crd),lng=number(s.lo_crd);
  if(lat<37||lat>38||lng<126||lng>128)throw new Error("Invalid Seoul coordinate");
  const count=(v:unknown)=>{const n=number(v);if(!Number.isInteger(n)||n<0)throw new Error("Invalid count");return n;};
  let rings: Point[][]=[];
  try {
    const geometry=typeof s.geom_json==="string"?JSON.parse(s.geom_json):s.geom_json;
    if(geometry?.type==="Polygon"&&Array.isArray(geometry.coordinates))rings=geometry.coordinates.map((ring:unknown[])=>ring.map(pair=>{
      if(!Array.isArray(pair)||pair.length<2)throw new Error("Invalid polygon");
      const x=number(pair[0]),y=number(pair[1]);if(y<37||y>38||x<126||x>128)throw new Error("Invalid polygon coordinate");return {lng:x,lat:y};
    })).filter((ring:Point[])=>ring.length>=4);
  }catch{rings=[];} // Preserve official center even when optional polygon is unavailable.
  if(typeof s.spot_nm!=="string"||(!s.afos_fid&&!s.spot_cd))throw new Error("Missing zone identity");
  return {id:String(s.afos_fid??s.spot_cd),name:s.spot_nm,year,lat,lng,accidents:count(s.occrrnc_cnt),casualties:count(s.caslt_cnt),deaths:count(s.dth_dnv_cnt),rings};
}

export function compareRouteZones(routes: {mode:string;distance:number;duration:number;paths:{lat:number;lng:number}[][]}[], zones: AccidentZone[] | null) {
  return routes.map(route=>({mode:route.mode,distance:route.distance,duration:route.duration,
    zoneCount:zones===null?null:new Set(zonesNearRoute(zones,route.paths,300).map(zone=>zone.id)).size}));
}
