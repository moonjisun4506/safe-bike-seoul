import "server-only";
import { serverEnv } from "./env";
import { ApiError, fetchJson, list, numeric, object, requireKey, text } from "./http";
import type { Station } from "../stations";
let cached: { data: Station[]; fetchedAt: string; expires: number } | undefined;
let pending: Promise<NonNullable<typeof cached>> | undefined;
async function page(start: number) {
  const key = requireKey(serverEnv.seoulKey);
  const protocol = process.env.SEOUL_ALLOW_HTTP === "true" ? "http" : "https";
  const url = new URL(`${protocol}://openapi.seoul.go.kr:8088/${encodeURIComponent(key)}/json/bikeList/${start}/${start + 999}/`);
  const payload = object(await fetchJson(url));
  const result = payload.rentBikeStatus ? object(payload.rentBikeStatus) : payload;
  const code = object(result.RESULT).CODE;
  if (code === "INFO-200") return { rows: [], total: 0 };
  if (code === "ERROR-100") throw new ApiError(502, "SEOUL_AUTH_ERROR", "서울시 인증키가 유효하지 않거나 사용할 수 없습니다. 서버 SEOUL_API_KEY를 확인해 주세요.");
  if (code !== "INFO-000") throw new ApiError(502, "SEOUL_API_ERROR", "서울시 대여소 정보를 조회하지 못했습니다. 서버 인증 설정과 API 이용 상태를 확인해 주세요.");
  return { rows: list(result.row), total: numeric(result.list_total_count) };
}
async function load() {
  const rows: unknown[] = [];
  // list_total_count can describe the current page, not the citywide total.
  // Continue until a short/empty page; never rank a partial snapshot as complete.
  let complete = false;
  for (let start = 1; start <= 20001; start += 1000) {
    const current = await page(start);
    rows.push(...current.rows);
    if (current.rows.length < 1000) { complete = true; break; }
  }
  if (!complete) throw new Error("Station pagination limit exceeded");
  const unique = new Map<string, Station>();
  for (const row of rows) {
    try {
      const s = object(row);
      const station = { id: text(s.stationId), name: text(s.stationName), bikes: numeric(s.parkingBikeTotCnt), racks: numeric(s.rackTotCnt), lat: numeric(s.stationLatitude), lng: numeric(s.stationLongitude) };
      if (station.lat < 37 || station.lat > 38 || station.lng < 126 || station.lng > 128 || station.bikes < 0 || !Number.isInteger(station.bikes)) continue;
      unique.set(station.id, station);
    } catch { /* skip invalid locations instead of plotting misleading markers */ }
  }
  if (rows.length > 0 && !unique.size) throw new Error("No valid stations");
  return { data: [...unique.values()], fetchedAt: new Date().toISOString(), expires: Date.now() + 60000 };
}
export async function getStations() {
  if (cached && cached.expires > Date.now()) return cached;
  if (!pending) pending = load().then(value => { cached = value; return value; }).finally(() => { pending = undefined; });
  return pending;
}


