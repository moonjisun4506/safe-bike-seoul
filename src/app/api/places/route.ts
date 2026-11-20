import { serverEnv } from "@/lib/server/env";
import { ApiError, fetchJson, handle, json, list, numeric, object, requireKey, text } from "@/lib/server/http";
import { places } from "@/app/demo-data";

export async function GET(request: Request) {
  return handle(async () => {
    const query = new URL(request.url).searchParams.get("query")?.trim() || "";
    if (!query || query.length > 80) throw new ApiError(400, "INVALID_QUERY", "검색어를 1~80자로 입력해 주세요.");
    if (serverEnv.demo) return json(places.filter(p => p.name.includes(query) || p.address.includes(query)), "demo", true);
    const url = new URL("https://dapi.kakao.com/v2/local/search/keyword.json");
    url.searchParams.set("query", query); url.searchParams.set("size", "10");
    url.searchParams.set("rect", "126.76,37.41,127.19,37.70");
    const payload = object(await fetchJson(url, { Authorization: `KakaoAK ${requireKey(serverEnv.kakaoKey)}` }));
    const data = list(payload.documents).map(item => { const p = object(item); return {
      id: text(p.id), name: text(p.place_name), address: text(p.road_address_name) || text(p.address_name), lat: numeric(p.y), lng: numeric(p.x),
    }; });
    return json(data, "kakao", false);
  });
}

// Deployment platform execution budget (seconds).
export const maxDuration = 15;
