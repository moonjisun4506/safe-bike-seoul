export type RouteMode = "BIKE_ONLY" | "SHORTEST";
export type CyclingRoute = { mode: RouteMode; distance: number; duration: number; paths: {lat:number;lng:number}[][] };
export function parseCyclingRoute(payload: unknown, mode: RouteMode): CyclingRoute {
  const obj = (v: unknown): Record<string, unknown> => {
    if (!v || typeof v !== "object" || Array.isArray(v)) throw new Error("Invalid route object");
    return v as Record<string, unknown>;
  };
  const arr = (v: unknown): unknown[] => { if (!Array.isArray(v)) throw new Error("Missing route geometry"); return v; };
  const num = (v: unknown) => { if (typeof v !== "number" || !Number.isFinite(v) || v < 0) throw new Error("Invalid route number"); return v; };
  const root = obj(payload);
  if (root.status !== "OK") throw new Error("Route unavailable");
  const route = obj(root.route), properties = obj(route.properties);
  const paths = arr(route.legs).flatMap(leg => arr(obj(leg).steps).map(step => arr(obj(obj(step).path).points).map(pair => {
    const coords = arr(pair);
    if (coords.length !== 2) throw new Error("Invalid coordinate pair");
    const lng = num(coords[0]), lat = num(coords[1]);
    if (lat < 33 || lat > 39 || lng < 124 || lng > 132) throw new Error("Invalid route coordinate");
    return { lat, lng };
  }))).filter(path => path.length >= 2);
  if (!paths.length) throw new Error("Empty route geometry");
  return { mode, distance: num(properties.totalDistance), duration: num(properties.totalTime), paths };
}
