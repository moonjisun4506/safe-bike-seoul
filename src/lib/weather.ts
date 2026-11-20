export type ForecastIssue = { date: string; time: string };
export type WeatherForecast = { temperature: number; precipitationProbability: number; issuedAt: string; forecastAt: string; grid: {nx:number;ny:number} };
export function toKmaGrid(lat:number,lng:number){
  if(!Number.isFinite(lat)||!Number.isFinite(lng)||lat<33||lat>39||lng<124||lng>132)throw new Error("Outside supported coordinates");
  const rad=Math.PI/180,re=6371.00877/5;
  const slat1=30*rad,slat2=60*rad,olat=38*rad;
  const sn=Math.log(Math.cos(slat1)/Math.cos(slat2))/Math.log(Math.tan(Math.PI*.25+slat2*.5)/Math.tan(Math.PI*.25+slat1*.5));
  const sf=Math.pow(Math.tan(Math.PI*.25+slat1*.5),sn)*Math.cos(slat1)/sn;
  const ro=re*sf/Math.pow(Math.tan(Math.PI*.25+olat*.5),sn);
  const ra=re*sf/Math.pow(Math.tan(Math.PI*.25+lat*rad*.5),sn);
  let theta=(lng-126)*rad;if(theta>Math.PI)theta-=2*Math.PI;if(theta< -Math.PI)theta+=2*Math.PI;
  theta*=sn;
  const nx=Math.floor(ra*Math.sin(theta)+43+.5),ny=Math.floor(ro-ra*Math.cos(theta)+136+.5);
  if(nx<1||nx>149||ny<1||ny>253)throw new Error("Outside KMA grid");
  return {nx,ny};
}
export function forecastIssue(now:Date,lagMinutes=10):ForecastIssue{
  const adjusted=new Date(now.getTime()+9*3600000-lagMinutes*60000);
  const hours=[23,20,17,14,11,8,5,2];
  let hour=hours.find(h=>h<=adjusted.getUTCHours());
  if(hour===undefined){adjusted.setUTCDate(adjusted.getUTCDate()-1);hour=23;}
  return {date:adjusted.toISOString().slice(0,10).replaceAll("-",""),time:String(hour).padStart(2,"0")+"00"};
}
export function kstTimestamp(date:string,time:string){
  if(!/^\d{8}$/.test(date)||!/^\d{4}$/.test(time))throw new Error("Invalid forecast time");
  const value=`${date.slice(0,4)}-${date.slice(4,6)}-${date.slice(6,8)}T${time.slice(0,2)}:${time.slice(2)}:00+09:00`;
  if(!Number.isFinite(Date.parse(value)))throw new Error("Invalid forecast timestamp");
  return value;
}
export function selectForecast(items:unknown[],issue:ForecastIssue,grid:{nx:number;ny:number},now:Date):WeatherForecast{
  const groups=new Map<string,{temperature?:number;precipitationProbability?:number;date:string;time:string}>();
  for(const value of items){
    if(!value||typeof value!=="object")continue;
    const row=value as Record<string,unknown>;
    if(row.baseDate!==issue.date||row.baseTime!==issue.time||Number(row.nx)!==grid.nx||Number(row.ny)!==grid.ny)continue;
    if(row.category!=="TMP"&&row.category!=="POP")continue;
    if(typeof row.fcstDate!=="string"||typeof row.fcstTime!=="string")continue;
    if((typeof row.fcstValue!=="string"&&typeof row.fcstValue!=="number")||String(row.fcstValue).trim()==="")continue;
    const number=Number(row.fcstValue);if(!Number.isFinite(number))continue;
    if(row.category==="TMP"&&(number< -90||number>65))continue;
    if(row.category==="POP"&&(number<0||number>100))continue;
    const key=row.fcstDate+row.fcstTime;
    const group=groups.get(key)??{date:row.fcstDate,time:row.fcstTime};
    if(row.category==="TMP")group.temperature=number;else group.precipitationProbability=number;
    groups.set(key,group);
  }
  for(const [,group] of [...groups.entries()].sort(([a],[b])=>a.localeCompare(b))){
    if(group.temperature===undefined||group.precipitationProbability===undefined)continue;
    const forecastAt=kstTimestamp(group.date,group.time);
    if(Date.parse(forecastAt)<now.getTime())continue;
    return {temperature:group.temperature,precipitationProbability:group.precipitationProbability,issuedAt:kstTimestamp(issue.date,issue.time),forecastAt,grid};
  }
  throw new Error("No matching future TMP/POP forecast");
}
