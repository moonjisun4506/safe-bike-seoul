import { chromium } from "@playwright/test";
const browser=await chromium.launch({channel:"msedge",headless:true});
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000},locale:"ko-KR"});
 const errors=[];page.on("pageerror",e=>errors.push(e.message.replace(/https?:\/\/\S+/g,"[URL]")));
 const sdk=[];page.on("response",r=>{if(r.url().includes("dapi.kakao.com/v2/maps/sdk.js"))sdk.push(r.status());});
 await page.goto("http://127.0.0.1:3000",{waitUntil:"domcontentloaded"});
 await page.waitForTimeout(12000);
 console.log(JSON.stringify({title:await page.title(),sdkStatus:sdk,mapMode:await page.locator(".map-mode").innerText(),stations:await page.locator(".station-list button").count(),routes:await page.locator(".route-comparison tbody tr").count(),routeText:await page.locator(".route-comparison").innerText(),weather:await page.locator(".weather-card").innerText(),alerts:await page.getByRole("alert").allTextContents(),errors}));
 await page.screenshot({path:"artifacts/qa-desktop-initial.png",fullPage:true});
 await page.setViewportSize({width:390,height:844});await page.waitForTimeout(500);
 console.log(JSON.stringify({mobileOverflow:await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),mobileWidth:await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth})),mapBox:await page.locator(".map-panel").boundingBox()}));
 await page.screenshot({path:"artifacts/qa-mobile-initial.png",fullPage:true});
}finally{await browser.close();}
