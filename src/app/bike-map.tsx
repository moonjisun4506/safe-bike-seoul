"use client";
import { useEffect, useRef, useState } from "react";
import { type Place } from "./demo-data";

import type { NearbyStation } from "@/lib/stations";
import type { CyclingRoute } from "@/lib/cycling-route";
import type { AccidentZone } from "@/lib/accidents";
type Coordinate = object;
type MapOverlay = {setMap: (map: MapInstance | null) => void};
type MapInstance = { setBounds: (bounds: object) => void; relayout: () => void };
type Maps = {
  load: (callback: () => void) => void;
  LatLng: new (lat: number, lng: number) => Coordinate;
  Map: new (element: HTMLElement, options: object) => MapInstance;
  LatLngBounds: new () => { extend: (point: Coordinate) => void };
  CustomOverlay: new (options: object) => MapOverlay;
  Polyline: new (options: object) => MapOverlay;
  Polygon: new (options: object) => MapOverlay;
};
declare global { interface Window { kakao?: { maps: Maps } } }

type Props = { start: Place; end: Place; bikes: boolean; safety: boolean; cyclingRoute: CyclingRoute | null; accidentZones: AccidentZone[]; nearZoneIds: string[]; stations: NearbyStation[]; selectedStation: string | null; onStation: (id: string) => void };
export default function BikeMap({ start, end, bikes, safety, cyclingRoute, accidentZones, nearZoneIds, stations, selectedStation, onStation }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapInstance | null>(null);
  const fitRef = useRef("");
  const sizeRef = useRef("");
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const key = process.env.NEXT_PUBLIC_KAKAO_MAP_KEY;
  useEffect(() => {
    if (!key) return;
    let active = true;
    const loaded = () => { try { window.kakao?.maps.load(() => { if (active) { clearTimeout(timer); setFailed(false); setReady(true); } }); } catch { if(active) setFailed(true); } };
    const script = document.createElement("script");
    script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${encodeURIComponent(key)}&autoload=false`;
    script.onload = loaded;
    script.onerror = () => { if (active) setFailed(true); };
    const timer = setTimeout(() => { if (active) setFailed(true); }, 12000);
    document.head.appendChild(script);
    return () => { active = false; clearTimeout(timer); script.remove(); };
  }, [key]);
  useEffect(() => {
    const maps = window.kakao?.maps;
    if (!ready || !maps || !container.current) return;
    const root = container.current;
    const map = mapRef.current ?? new maps.Map(root, { center: new maps.LatLng(start.lat, start.lng), level: 7 });
    mapRef.current = map;
    const overlays: MapOverlay[] = [];
    const bounds = new maps.LatLngBounds();
    const point = (lat: number, lng: number) => new maps.LatLng(lat, lng);
    const marker = (lat: number, lng: number, text: string, className: string, click?: () => void, title?: string) => {
      const content = document.createElement("button"); content.className = `map-pin ${className}`; content.textContent = text; content.type="button"; content.title=title ?? text; content.setAttribute("aria-label",title ?? text);
      if (click) content.onclick = click;
      overlays.push(new maps.CustomOverlay({ map, position: point(lat, lng), content, yAnchor: 1, zIndex: className.includes("chosen-pin") ? 6 : className.includes("near-accident") ? 5 : 2 }));
    };
    bounds.extend(point(start.lat, start.lng)); bounds.extend(point(end.lat, end.lng));
    if (cyclingRoute) for (const section of cyclingRoute.paths) {
      const path = section.map(p => point(p.lat, p.lng));
      path.forEach(p => bounds.extend(p));
      overlays.push(new maps.Polyline({ map, path, strokeWeight: 6, strokeColor: cyclingRoute.mode === "SHORTEST" ? "#5275c5" : "#167b59", strokeOpacity: .9 }));
    }
    const departure = stations.find(s => s.id === selectedStation);
    if (departure) marker(departure.lat, departure.lng, "대여소 출발", "endpoint");
    marker(end.lat, end.lng, "도착", "endpoint destination");
    if (bikes) stations.forEach(s => { bounds.extend(point(s.lat, s.lng)); marker(s.lat, s.lng, `♧ ${s.bikes}`, s.id === selectedStation ? "chosen-pin" : s.bikes===0 ? "empty-pin" : "", () => onStation(s.id), `${s.name} · 대여 가능 ${s.bikes}대`); });
    if (safety) accidentZones.forEach(zone => {
      const nearby = nearZoneIds.includes(zone.id);
      if (zone.rings.length) overlays.push(new maps.Polygon({ map, path: zone.rings.map(ring=>ring.map(p=>point(p.lat,p.lng))), strokeWeight: nearby?3:1, strokeColor: nearby?"#c94135":"#bb8133", fillColor: nearby?"#de5647":"#e6ad51", fillOpacity: .18 }));
      marker(zone.lat, zone.lng, `! ${zone.accidents}`, nearby ? "warning near-accident" : "warning", undefined, `${zone.name} · ${zone.year}년 사고 ${zone.accidents}건`);
    });
    const fitKey = `${start.id}:${end.id}:${cyclingRoute?.mode ?? ""}:${stations.map(s=>s.id).join(",")}`;
    if (fitRef.current !== fitKey) { map.setBounds(bounds); fitRef.current = fitKey; }
    const observer = new ResizeObserver(() => { const size = `${root.clientWidth}:${root.clientHeight}`; if (sizeRef.current !== size) { map.relayout(); map.setBounds(bounds); sizeRef.current = size; } }); observer.observe(root);
    return () => { observer.disconnect(); overlays.forEach(overlay=>overlay.setMap(null)); };
  }, [ready, start, end, bikes, safety, cyclingRoute, accidentZones, nearZoneIds, stations, selectedStation, onStation]);
  const demo = !ready || failed;
  return <div className="map-stage">
    <div ref={container} className="kakao-map" aria-label="카카오 지도" style={{ visibility: ready ? "visible" : "hidden" }} />
    {demo && !ready && <div className="demo-map" aria-label="서울 한강 일대의 개략적인 예시 지도">
      <svg viewBox="0 0 1000 760" preserveAspectRatio="none" aria-hidden="true">
        <defs><pattern id="grid" width="88" height="70" patternUnits="userSpaceOnUse" patternTransform="rotate(-18)"><rect width="88" height="70" fill="#edf0e7"/><path d="M0 0H88V70" fill="none" stroke="#fff" strokeWidth="12"/></pattern></defs>
        <rect width="1000" height="760" fill="url(#grid)"/>
        <path d="M-50 500C180 250 270 500 490 380S770 370 1050 130" stroke="#d3e6c4" strokeWidth="185" fill="none"/>
        <path d="M-50 500C180 250 270 500 490 380S770 370 1050 130" stroke="#b8dce5" strokeWidth="115" fill="none"/>
        {[250, 480, 710].map(x => <path key={x} d={`M${x} 180L${x + 80} 640`} stroke="#fff" strokeWidth="14"/>)}
      </svg>
      <span className="area-label yeouido">여의도</span><span className="area-label yongsan">용산구</span><span className="area-label seocho">서초구</span><span className="river-label">한 강</span>
      <span className="map-pin endpoint" style={{ left: `${start.x}%`, top: `${start.y}%` }}>출발</span><span className="map-pin endpoint destination" style={{ left: `${end.x}%`, top: `${end.y}%` }}>도착</span>
    </div>}
    <div className="map-mode">{ready ? "Kakao Map · 대여소는 서울시 데이터" : failed ? "지도 연결 실패 · 예시 지도로 표시" : key ? "카카오 지도 연결 중 · 예시 지도" : "예시 지도 · 카카오맵 키 설정 전"}</div>
    <div className="map-disclaimer">대여소: 서울시 · 경로: 카카오맵 · 사고정보: 과거 연간 통계 · 지도 연결 전에는 실제 경로와 대여소를 그리지 않습니다.</div>
  </div>;
}





