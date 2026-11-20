import { getStations } from "@/lib/server/stations";
import { nearbyStations } from "@/lib/stations";
import { ApiError, handle, integer } from "@/lib/server/http";
function coordinate(params: URLSearchParams, name: string, min: number, max: number) {
  const raw = params.get(name);
  if (raw === null || !raw.trim() || !Number.isFinite(Number(raw)) || Number(raw) < min || Number(raw) > max)
    throw new ApiError(400, "INVALID_PARAMETER", `${name}에 서울 지역의 좌표를 입력해 주세요.`);
  return Number(raw);
}
export async function GET(request: Request) {
  return handle(async () => {
    const params = new URL(request.url).searchParams;
    const lat = coordinate(params, "lat", 37, 38);
    const lng = coordinate(params, "lng", 126, 128);
    const limit = integer(params, "limit", 20, 1, 100);
    const radius = integer(params, "radius", 2000, 100, 10000);
    const snapshot = await getStations();
    return Response.json({ data: nearbyStations(snapshot.data, lat, lng, radius, limit), meta: {
      source: "seoul", isDemo: false, fetchedAt: snapshot.fetchedAt, totalStations: snapshot.data.length,
      center: { lat, lng }, radiusMeters: radius, distanceType: "straight-line", cacheSeconds: 60,
    } }, { headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
  });
}

// Deployment platform execution budget (seconds).
export const maxDuration = 60;
