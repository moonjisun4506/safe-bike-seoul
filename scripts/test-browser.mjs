import { chromium, expect as baseExpect } from "@playwright/test";
import { writeFile } from "node:fs/promises";
const expect=baseExpect.configure({timeout:25000});
const browser=await chromium.launch({channel:"msedge",headless:true});
const report=[];
async function check(name,run){await run();report.push({name,result:"passed"});console.log("PASS:",name);}
async function open(overrides={}){
 const context=await browser.newContext({viewport:{width:1440,height:1000},locale:"ko-KR"});const page=await context.newPage();const errors=[];
 page.on("pageerror",e=>errors.push(e.message.replace(/https?:\/\/\S+/g,"[URL]")));page.on("console",m=>{if(m.type()==="error"&&/Error: Route|hydration|Hydration/.test(m.text()))errors.push(m.text().replace(/https?:\/\/\S+/g,"[URL]"));});
 for(const [path,body] of Object.entries(overrides))await page.route(`**/api/${path}*`,route=>route.fulfill({status:body.error?503:200,contentType:"application/json",body:JSON.stringify(body)}));
 await page.goto("http://127.0.0.1:3000",{waitUntil:"domcontentloaded"});return {context,page,errors};
}
try{
 const {context,page,errors}=await open();
 await check("real SDK, station markers, route geometry, accident polygons, forecast",async()=>{
  await expect(page.locator(".map-mode")).toContainText("Kakao Map");
  await expect(page.locator(".station-list button")).toHaveCount(20);
  await expect(page.locator(".route-comparison tbody button")).toHaveCount(2);
  await expect(page.locator(".weather-main b")).toContainText("°C");
  await expect(page.locator(".accident-card")).toContainText("2025년");
  await expect(page.locator(".kakao-map .chosen-pin")).toHaveCount(1);
  expect(await page.locator(".kakao-map svg path").count()).toBeGreaterThan(0);
 });
 await check("route choice updates table and real map line",async()=>{
  await page.locator(".route-comparison tbody button").nth(1).click();
  await expect(page.locator(".route-comparison tbody button").nth(1)).toHaveAttribute("aria-pressed","true");
  await expect(page.locator('.kakao-map path[style*="stroke: rgb(82, 117, 197)"]').first()).toBeAttached();
 });
 await check("station selection requests route from that station",async()=>{
  const response=page.waitForResponse(r=>r.url().includes("/api/routes?")&&r.status()===200);
  await page.locator(".station-list button").nth(2).click();const data=await(await response).json();
  await expect(page.locator(".station-summary")).toContainText(data.data.origin.name);
  await expect(page.locator(".route-comparison tbody button")).toHaveCount(2);
 });
 await check("radius changes station search and actual nearest distances",async()=>{
  const response=page.waitForResponse(r=>r.url().includes("/api/stations?")&&r.url().includes("radius=500"));
  await page.locator(".station-controls select").selectOption("500");const p=await(await response).json();
  expect(p.data.length).toBeGreaterThan(0);expect(p.data.every(s=>s.distanceMeters<=500)).toBe(true);
  for(let i=1;i<p.data.length;i++)expect(p.data[i].distanceMeters).toBeGreaterThanOrEqual(p.data[i-1].distanceMeters);
 });
 await check("search empty state and origin change reload weather/grid",async()=>{
  await page.locator("#start").fill("존재하지않는예시장소");await expect(page.locator(".search-results")).toContainText("없습니다");
  await page.locator("#start").fill("반포");const response=page.waitForResponse(r=>r.url().includes("/api/weather?lat=37.5097"));
  await page.locator(".search-results>button").click();const p=await(await response).json();
  expect(p.meta.source).toBe("kma");await expect(page.locator(".weather-card")).toContainText("반포한강공원");
  const refreshed=page.waitForResponse(r=>r.url().includes("/api/stations?")&&r.url().includes("radius=2000"));
  await page.locator(".station-controls select").selectOption("2000");await refreshed;
  await expect(page.locator(".station-list button").first()).toBeVisible();
 });
 await check("layer toggles remove and restore overlays",async()=>{
  const toggle=page.locator(".layer-controls button").nth(1);await toggle.click();await expect(page.locator(".kakao-map .warning")).toHaveCount(0);await expect(page.locator(".accident-card")).toHaveCount(0);await toggle.click();await expect(page.locator(".kakao-map .warning").first()).toBeAttached();
 });
 await check("station refresh preserves map DOM instance",async()=>{
  await page.evaluate(()=>{document.querySelector(".kakao-map").firstElementChild.setAttribute("data-qa-map-instance","original");});
  await page.locator(".station-controls button").click();await expect(page.locator(".station-controls button")).toBeEnabled();
  expect(await page.locator('[data-qa-map-instance="original"]').count()).toBe(1);
 });
 await page.reload();await expect(page.locator(".route-comparison tbody button")).toHaveCount(2);await expect(page.locator(".map-mode")).toContainText("Kakao Map");
 await page.screenshot({path:"artifacts/qa-desktop.png",fullPage:true});
 for(const width of [360,390,768])await check(`responsive ${width}px without overflow`,async()=>{
  await page.setViewportSize({width,height:844});await page.waitForTimeout(200);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  if(width<760){const map=await page.locator(".map-stage").boundingBox(),cards=await page.locator(".map-bottom").boundingBox();expect(cards.y).toBeGreaterThanOrEqual(map.y+map.height-1);}
 });
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:"artifacts/qa-mobile.png",fullPage:true});
 expect(errors).toEqual([]);await context.close();
 const empty=await open({stations:{data:[],meta:{fetchedAt:new Date().toISOString()}}});
 await check("empty stations clear route and disable request",async()=>{
  await expect(empty.page.locator(".station-card")).toContainText("반경 안에 대여소가 없습니다");
  await expect(empty.page.locator(".primary-button")).toBeDisabled();await expect(empty.page.locator(".route-comparison tbody button")).toHaveCount(0);
 });await empty.context.close();
 const denied=await open({accidents:{error:{code:"ACCIDENT_KEY_MISSING",message:"사고 API 인증 설정을 확인해 주세요."}},weather:{error:{code:"WEATHER_ACCESS_DENIED",message:"기상청 접근 거부(HTTP 403)"}},routes:{error:{code:"KAKAO_PERMISSION_DENIED",message:"카카오 경로 권한 거부(HTTP 403)"}}});
 await check("permission errors never show fake forecasts/routes/zero accidents",async()=>{
  await expect(denied.page.locator(".weather-card")).toContainText("403");await expect(denied.page.locator(".weather-main")).toHaveCount(0);
  await expect(denied.page.locator(".route-comparison tbody button")).toHaveCount(0);await expect(denied.page.locator(".sidebar")).toContainText("카카오 경로 권한 거부");
  await expect(denied.page.locator(".accident-card")).toContainText("인증 설정");expect(await denied.page.locator(".kakao-map .warning").count()).toBe(0);
 });await denied.context.close();
 const unknown=await open({accidents:{error:{code:"UNAVAILABLE",message:"사고정보 조회 실패"}}});
 await check("unknown accident data is not zero in comparison",async()=>{
  await expect(unknown.page.locator(".route-comparison tbody button")).toHaveCount(2);
  await expect(unknown.page.locator(".route-comparison tbody tr").first()).toContainText("확인 불가");
 });await unknown.context.close();
 const noRoute=await open({routes:{error:{code:"KAKAO_NO_ROUTE",message:"유효한 자전거 경로가 없습니다."}}});
 await check("no-route result leaves no route geometry",async()=>{
  await expect(noRoute.page.locator(".sidebar")).toContainText("유효한 자전거 경로가 없습니다");await expect(noRoute.page.locator(".route-comparison tbody button")).toHaveCount(0);
  expect(await noRoute.page.locator('.kakao-map path[style*="stroke: rgb(22, 123, 89)"],.kakao-map path[style*="stroke: rgb(82, 117, 197)"]').count()).toBe(0);
 });await noRoute.context.close();
 const fallback=await browser.newContext();const fallbackPage=await fallback.newPage();await fallbackPage.route("**/v2/maps/sdk.js?**",route=>route.abort());await fallbackPage.goto("http://127.0.0.1:3000");
 await check("SDK network failure retains list and explicit map failure",async()=>{
  await expect(fallbackPage.locator(".map-mode")).toContainText("지도 연결 실패");await expect(fallbackPage.locator(".station-list button")).toHaveCount(20);await expect(fallbackPage.locator(".kakao-map .map-pin")).toHaveCount(0);
 });await fallback.close();
}finally{await browser.close();await writeFile("artifacts/browser-test-results.json",JSON.stringify(report,null,2));}




