import assert from "node:assert/strict";
import test from "node:test";

const base = process.env.TEST_BASE_URL || "http://127.0.0.1:3000";
const cases = [
  ["/api/places?query=" + encodeURIComponent("여의"), 200],
  ["/api/places?query=" + encodeURIComponent("없는예시장소"), 200],
  ["/api/places", 400],
  ["/api/places?query=" + "a".repeat(81), 400],

  ["/api/stations?lat=37.5&lng=127&limit=101", 400],
  ["/api/stations?lat=NaN&lng=127", 400],
  ["/api/stations?lat=37.5", 400],
  ["/api/weather", 400],
  ["/api/weather?nx=0", 400],
  ["/api/weather?ny=254", 400],
  ["/api/accidents", 200],
  ["/api/routes?stationId=bad!&endLat=37.5&endLng=127", 400],
  ["/api/routes?start=1&end=1", 400],
  ["/api/routes?start=not-a-place&end=2", 400],
];
for (const [path, status] of cases) {
  test(`GET ${path}: ${status}`, async () => {
    const response = await fetch(new URL(path, base));
    assert.equal(response.status, status);
    assert.equal(response.headers.get("cache-control"), "no-store");
    const payload = await response.json();
    if (status === 200) {
      assert.equal(payload.meta.isDemo, path === "/api/accidents" ? false : true, "Run these tests with API_DATA_MODE=demo");
      assert.equal(payload.meta.source, path === "/api/accidents" ? "koroad" : "demo");
      assert.ok(payload.meta.fetchedAt);
      if (path.includes("limit=2")) assert.equal(payload.data.length, 2);
      if (path.includes("%EC%97%86")) assert.deepEqual(payload.data, []);
    } else {
      assert.ok(payload.error.code);
      assert.deepEqual(Object.keys(payload.error).sort(), ["code", "message"]);
    }
  });
}
test("unsupported write method is rejected", async () => {
  const response = await fetch(new URL("/api/stations", base), { method: "POST" });
  assert.equal(response.status, 405);
});




