import { getStations } from "@/lib/server/stations";
import { serverEnv } from "@/lib/server/env";
import { ApiError, handle, json, requireKey } from "@/lib/server/http";
import { parseCyclingRoute, type RouteMode } from "@/lib/cycling-route";
function coordinate(params: URLSearchParams, name: string, min: number, max: number) {
  const value = params.get(name);
  if (value === null || !value.trim() || !Number.isFinite(Number(value)) || Number(value) < min || Number(value) > max)
    throw new ApiError(400, "INVALID_ROUTE", "목적지 좌표가 올바르지 않습니다.");
  return Number(value);
}
async function fetchRoute(mode: RouteMode, origin: {lat:number;lng:number}, end: {lat:number;lng:number}, key: string) {
  const url = new URL("https://dapi.kakao.com/v2/routing/bicycle");
  url.search = new URLSearchParams({ start_x: String(origin.lng), start_y: String(origin.lat), end_x: String(end.lng), end_y: String(end.lat), route_mode: mode, input_coord: "WGS84", output_coord: "WGS84" }).toString();
  let response: Response;
  try { response = await fetch(url, { headers: { Authorization: `KakaoAK ${key}` }, cache: "no-store", redirect: "error", signal: AbortSignal.timeout(8000) }); }
  catch { throw new ApiError(502, "KAKAO_NETWORK_ERROR", "카카오 자전거 경로 API에 연결하지 못했거나 응답 시간이 초과되었습니다. 경로를 생성하지 않았습니다."); }
  if (response.status === 401) throw new ApiError(502, "KAKAO_AUTH_ERROR", "카카오 인증에 실패했습니다(HTTP 401). 서버 REST 키를 확인해 주세요.");
  if (response.status === 403) throw new ApiError(502, "KAKAO_PERMISSION_DENIED", "카카오 자전거 경로 호출이 거부되었습니다(HTTP 403). 앱의 API 사용 권한과 키/IP 제한을 확인해 주세요.");
  if (response.status === 429) throw new ApiError(503, "KAKAO_QUOTA_EXCEEDED", "카카오 API 호출 한도를 초과했습니다(HTTP 429). 잠시 후 다시 시도해 주세요.");
  if (!response.ok) throw new ApiError(502, "KAKAO_ROUTE_ERROR", `카카오 자전거 경로 조회가 실패했습니다(HTTP ${response.status}). 경로를 생성하지 않았습니다.`);
  let payload: unknown;
  try { payload = await response.json(); } catch { throw new ApiError(502, "KAKAO_INVALID_RESPONSE", "카카오 경로 응답을 읽지 못했습니다. 경로를 생성하지 않았습니다."); }
  try { return parseCyclingRoute(payload, mode); }
  catch { throw new ApiError(502, "KAKAO_NO_ROUTE", `${mode === "BIKE_ONLY" ? "자전거도로 우선" : "최단"} 경로에 유효한 경로 좌표가 없습니다. 대여소 또는 목적지를 변경해 주세요. 임의 경로는 생성하지 않았습니다.`); }
}
export async function GET(request: Request) {
  return handle(async () => {
    const params = new URL(request.url).searchParams;
    const stationId = params.get("stationId");
    const end = { lat: coordinate(params, "endLat", 33, 39), lng: coordinate(params, "endLng", 124, 132) };
    if (!stationId || !/^[A-Za-z0-9_-]{1,40}$/.test(stationId)) throw new ApiError(400, "INVALID_STATION", "출발할 따릉이 대여소를 선택해 주세요.");
    const key = requireKey(serverEnv.kakaoKey);
    const snapshot = await getStations();
    const origin = snapshot.data.find(s => s.id === stationId);
    if (!origin) throw new ApiError(404, "STATION_NOT_FOUND", "선택한 대여소를 서울시 목록에서 찾지 못했습니다. 대여소를 다시 선택해 주세요.");
    const routes = await Promise.all((["BIKE_ONLY", "SHORTEST"] as const).map(mode => fetchRoute(mode, origin, end, key)));
    return json({ origin: { id: origin.id, name: origin.name, lat: origin.lat, lng: origin.lng }, destination: end, routes }, "kakao", false);
  });
}

// Deployment platform execution budget (seconds).
export const maxDuration = 60;
