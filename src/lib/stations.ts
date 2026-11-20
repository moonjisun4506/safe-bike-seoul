export type Station = { id: string; name: string; bikes: number; racks: number; lat: number; lng: number };
export type NearbyStation = Station & { distanceMeters: number };
export function distanceMeters(lat: number, lng: number, targetLat: number, targetLng: number) {
  const radians = (n: number) => n * Math.PI / 180;
  const a = Math.sin(radians(targetLat - lat) / 2) ** 2 + Math.cos(radians(lat)) * Math.cos(radians(targetLat)) * Math.sin(radians(targetLng - lng) / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(Math.max(0, 1 - a)));
}
export function nearbyStations(stations: Station[], lat: number, lng: number, radius: number, limit: number): NearbyStation[] {
  return stations.map(s => ({ ...s, distanceMeters: distanceMeters(lat, lng, s.lat, s.lng) }))
    .filter(s => s.distanceMeters <= radius).sort((a, b) => a.distanceMeters - b.distanceMeters || a.id.localeCompare(b.id)).slice(0, limit)
    .map(s => ({ ...s, distanceMeters: Math.round(s.distanceMeters) }));
}
