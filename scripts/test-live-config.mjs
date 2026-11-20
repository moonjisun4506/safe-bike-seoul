import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";

// Override credentials in the isolated test process; never change the local .env.
const server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "--hostname", "127.0.0.1", "--port", "3101"], {
  env: { ...process.env, API_DATA_MODE: "live", SEOUL_API_KEY: "", DATA_GO_KR_API_KEY: "", KMA_SERVICE_KEY: "", KAKAO_REST_API_KEY: "" },
  stdio: "ignore", windowsHide: true,
});
let exited = false;
server.on("exit", () => { exited = true; });
try {
  let ready = false;
  for (let i = 0; i < 40; i++) {
    if (exited) throw new Error("Isolated test server failed to start");
    try {
      const response = await fetch("http://127.0.0.1:3101/");
      if (response.ok) { ready = true; break; }
    } catch { /* wait for server */ }
    await delay(250);
  }
  assert.ok(ready, "Server readiness timeout");
  for (const endpoint of ["places?query=seoul", "stations?lat=37.5&lng=127", "weather?lat=37.5271&lng=126.9328", "routes?stationId=ST-1&endLat=37.5&endLng=127", "accidents"]) {
    const response = await fetch(`http://127.0.0.1:3101/api/${endpoint}`);
    assert.equal(response.status, 503);
    const payload = await response.json();
    if(endpoint === "accidents") { assert.equal(payload.error.code,"ACCIDENT_KEY_MISSING"); assert.ok(!("data" in payload)); } else { assert.deepEqual(payload, { error: { code: "NOT_CONFIGURED", message: "외부 API 인증 설정이 필요합니다." } }); }
  }
  console.log("PASS: live mode without keys returns safe 503 responses for all provider endpoints.");
} finally {
  server.kill();
}






