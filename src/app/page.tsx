"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import BikeMap from "./bike-map";
import { places, type Place } from "./demo-data";

import type { NearbyStation } from "@/lib/stations";
import type { CyclingRoute } from "@/lib/cycling-route";
import { ACCIDENT_SOURCE_URL, DOCUMENTED_LATEST_ACCIDENT_YEAR, zonesNearRoute, compareRouteZones, type AccidentSnapshot } from "@/lib/accidents";
import type { WeatherForecast } from "@/lib/weather";
export default function Home() {
  const [start, setStart] = useState(places[0]);
  const [end, setEnd] = useState(places[1]);
  const [weather, setWeather] = useState<{key:string;data:WeatherForecast;fetchedAt:string}|null>(null);
  const [weatherLoading,setWeatherLoading]=useState(true);
  const [weatherError,setWeatherError]=useState("");
  const [weatherRefresh,setWeatherRefresh]=useState(0);
  const weatherKey=`${start.lat}:${start.lng}`;
  const forecast=weather?.key===weatherKey?weather.data:null;
  const formatWeatherTime=(value:string)=>new Intl.DateTimeFormat("ko-KR",{timeZone:"Asia/Seoul",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",hour12:false}).format(new Date(value));
  useEffect(()=>{
    const controller=new AbortController();
    const load = async () => {
      await Promise.resolve();
      if (controller.signal.aborted) return;
    setWeather(null);setWeatherLoading(true);setWeatherError("");
    fetch(`/api/weather?lat=${start.lat}&lng=${start.lng}`,{signal:controller.signal}).then(async response=>{
      const payload=await response.json();if(!response.ok)throw new Error(payload.error?.message||"날씨 조회 실패");
      if(!controller.signal.aborted)setWeather({key:weatherKey,data:payload.data,fetchedAt:payload.meta.fetchedAt});
    }).catch(error=>{if(!controller.signal.aborted)setWeatherError(error instanceof Error?error.message:"날씨 조회 실패");})
    .finally(()=>{if(!controller.signal.aborted)setWeatherLoading(false);});
    };
    void load();
    return ()=>controller.abort();
  },[start.lat,start.lng,weatherKey,weatherRefresh]);
  const [queries, setQueries] = useState({ start: places[0].name, end: places[1].name });
  const [active, setActive] = useState<"start" | "end" | null>(null);
  const [bikes, setBikes] = useState(true);
  const [safety, setSafety] = useState(true);
  const [route, setRoute] = useState(0);
  const [routeResult, setRouteResult] = useState<{ key: string; routes: CyclingRoute[]; fetchedAt:string } | null>(null);
  const [routeLoading, setRouteLoading] = useState(false);
  const [routeError, setRouteError] = useState("");
  const [routeRefresh, setRouteRefresh] = useState(0);
  const [station, setStation] = useState<string | null>(null);
  const [stationData, setStationData] = useState<{ items: NearbyStation[]; fetchedAt: string; center: number } | null>(null);
  const [stationLoading, setStationLoading] = useState(true);
  const [stationError, setStationError] = useState("");
  const [radius, setRadius] = useState(2000);
  const [refresh, setRefresh] = useState(0);
  const stations = useMemo(() => stationData?.center === start.id ? stationData.items : [], [stationData,start.id]);
  const selectedStation = stations.find(s => s.id === station);
  const selectedStationId = selectedStation?.id;
  const routeKey = selectedStation ? `${selectedStation.id}:${end.lat}:${end.lng}` : "";
  const currentRoutes = useMemo(() => routeResult?.key === routeKey ? routeResult.routes : [], [routeResult,routeKey]);
  const currentRoute = currentRoutes[route] ?? null;
  const [accidentData, setAccidentData] = useState<AccidentSnapshot | null>(null);
  const [accidentLoading, setAccidentLoading] = useState(true);
  const [accidentError, setAccidentError] = useState("");
  const [accidentRefresh, setAccidentRefresh] = useState(0);
  const routeComparisons = useMemo(() => compareRouteZones(currentRoutes, accidentData?.data ?? null), [currentRoutes, accidentData]);
  const accidentZones = useMemo(() => accidentData?.data ?? [], [accidentData]);
  const nearAccidents = useMemo(() => currentRoute && accidentData ? zonesNearRoute(accidentData.data, currentRoute.paths, 300) : [], [currentRoute, accidentData]);
  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      await Promise.resolve();
      if (controller.signal.aborted) return;
    setAccidentLoading(true);setAccidentError("");setAccidentData(null);
    fetch("/api/accidents",{signal:controller.signal}).then(async response=>{
      const payload=await response.json();
      if(!response.ok)throw new Error(payload.error?.message||"사고정보를 조회하지 못했습니다.");
      if(!controller.signal.aborted)setAccidentData(payload);
    }).catch(error=>{if(!controller.signal.aborted)setAccidentError(error instanceof Error?error.message:"사고정보 조회 실패");})
    .finally(()=>{if(!controller.signal.aborted)setAccidentLoading(false);});
    };
    void load();
    return ()=>controller.abort();
  },[accidentRefresh]);
  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      await Promise.resolve();
      if (controller.signal.aborted) return;
    setRouteResult(null); setRouteError(""); setRoute(0);
    if (!routeKey || !selectedStationId) { setRouteLoading(false); return; }
    setRouteLoading(true);
    fetch(`/api/routes?stationId=${encodeURIComponent(selectedStationId)}&endLat=${end.lat}&endLng=${end.lng}`, { signal: controller.signal })
      .then(async response => {
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error?.message || "자전거 경로를 조회하지 못했습니다.");
        if (!controller.signal.aborted) setRouteResult({ key: routeKey, routes: payload.data.routes, fetchedAt:payload.meta.fetchedAt });
      })
      .catch(error => { if (!controller.signal.aborted) setRouteError(error instanceof Error ? error.message : "자전거 경로 조회 실패"); })
      .finally(() => { if (!controller.signal.aborted) setRouteLoading(false); });
    };
    void load();
    return () => controller.abort();
  }, [routeKey, selectedStationId, end.lat, end.lng, routeRefresh]);
  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      await Promise.resolve();
      if (controller.signal.aborted) return;
    setStationLoading(true); setStationError(""); setStationData(null); setStation(null);
    fetch(`/api/stations?lat=${start.lat}&lng=${start.lng}&radius=${radius}&limit=20`, { signal: controller.signal })
      .then(async response => {
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error?.message || "대여소 정보를 불러오지 못했습니다.");
        if (controller.signal.aborted) return;
        setStationData({ items: payload.data, fetchedAt: payload.meta.fetchedAt, center: start.id });
        setStation(payload.data[0]?.id ?? null);
      })
      .catch(error => { if (!controller.signal.aborted) setStationError(error instanceof Error ? error.message : "대여소 조회 실패"); })
      .finally(() => { if (!controller.signal.aborted) setStationLoading(false); });
    };
    void load();
    return () => controller.abort();
  }, [start.id, start.lat, start.lng, radius, refresh]);
  const nearZoneIds = useMemo(() => nearAccidents.map(a=>a.id), [nearAccidents]);
  const [notice, setNotice] = useState("");
  const selectStation = useCallback((id: string) => setStation(id), []);
  const choose = (place: Place) => {
    if (!active) return;
    if (active === "start") setStart(place); else setEnd(place);
    setQueries(q => ({ ...q, [active]: place.name })); setActive(null); setNotice("");
  };
  const swap = () => { setStart(end); setEnd(start); setQueries({ start: end.name, end: start.name }); setNotice(""); };
  return <div className="app-shell">
    <header className="topbar"><Link className="brand" href="/" aria-label="Safe Bike Seoul 홈"><span className="brand-icon">◎</span><span>Safe Bike <b>Seoul</b></span></Link><span className="header-caption">서울 자전거 이동정보 한눈에</span><span className="demo-badge">대여소 · 경로 · 과거 사고 · 예보</span></header>
    <div className="workspace">
      <aside className="sidebar">
        <div className="intro"><span className="eyebrow">YOUR NEXT RIDE</span><h1>오늘은 어디로<br />{" "}<span>달려볼까요?</span></h1><p>출발부터 도착까지, 한눈에 살펴보세요.</p></div>
        <a className="mobile-map-link" href="#ride-map">지도와 주변 대여소 보기</a>
        <section className="search-card" aria-label="출발지와 목적지 검색">
          {(["start", "end"] as const).map((field, i) => <div className="search-field" key={field}><span className={`field-dot ${i ? "end" : ""}`} /><div className="input-wrap"><label htmlFor={field}>{i ? "목적지" : "출발지"}</label><input id={field} value={queries[field]} onFocus={() => setActive(field)} onChange={e => { setQueries(q => ({ ...q, [field]: e.target.value })); setActive(field); }} autoComplete="off" placeholder="장소를 검색하세요" /></div></div>)}
          <button className="swap" onClick={swap} aria-label="출발지와 목적지 바꾸기">⇅</button>
          {active && <div className="search-results"><div className="result-heading">예시 장소 검색 <button onClick={() => setActive(null)}>닫기</button></div>{places.filter(p => p.name.includes(queries[active].trim()) || p.address.includes(queries[active].trim())).map(p => <button key={p.id} onClick={() => choose(p)}><strong>{p.name}</strong><small>{p.address}</small></button>)}{!places.some(p => p.name.includes(queries[active].trim()) || p.address.includes(queries[active].trim())) && <p>일치하는 예시 장소가 없습니다. 여의도, 반포, 뚝섬을 검색해 보세요.</p>}</div>}
        </section>
        <button className="primary-button" disabled={!selectedStation || routeLoading} onClick={() => { setActive(null); setRouteRefresh(n => n + 1); }}> {routeLoading ? "카카오 자전거 경로 조회 중" : "선택 대여소에서 목적지까지 조회"}</button>
        {notice && <p className="notice" role="status">{notice}</p>}
        <div className="section-heading"><h2>자전거 경로 비교</h2><span className="small-badge">카카오맵</span></div>
        <p className="muted-note">{selectedStation ? `${selectedStation.name} → ${end.name}` : "출발할 따릉이 대여소를 선택해 주세요."}</p>
        {routeLoading && <p role="status">자전거도로 우선·최단 경로를 조회하고 있습니다.</p>}
        {routeError && <p className="station-error" role="alert">{routeError}</p>}
        <div className="comparison-wrap"><table className="route-comparison"><caption>선택 대여소에서 목적지까지 · 사고지역 중심점과 경로의 직선거리 300m 기준</caption><thead><tr><th scope="col">경로 선택</th><th scope="col">거리 / 예상시간</th><th scope="col">과거 사고<br />다발지역</th></tr></thead><tbody>
          {routeComparisons.map((r,i)=><tr key={r.mode} className={route===i?"comparison-selected":""}><th scope="row"><button onClick={()=>setRoute(i)} aria-pressed={route===i}>{r.mode==="BIKE_ONLY"?"자전거도로 우선":"최단 경로"}<small>{route===i?"지도에 표시 중":"지도에 표시"}</small></button></th><td>{(r.distance/1000).toFixed(2)} km<br /><small>약 {Math.ceil(r.duration/60)}분</small></td><td>{r.zoneCount===null?<span>{accidentLoading?"조회 중":"확인 불가"}</span>:<b>{r.zoneCount}곳</b>}</td></tr>)}
          {!routeComparisons.length&&<tr><td colSpan={3}>{routeLoading?"경로 조회 중":"대여소와 목적지를 선택해 경로를 조회하세요."}</td></tr>}
        </tbody></table></div>
        <p className="comparison-caution">사고다발지역 수는 과거 통계와 거리 기준에 따른 참고값입니다. 수가 적거나 0곳이어도 더 안전한 경로라는 뜻은 아닙니다. 거리·시간은 카카오 예측값이며 현장 상황과 다를 수 있습니다.</p>
        <details className="data-provenance"><summary>정보 출처와 기준시각 <span>KST</span></summary><dl>
          <div><dt><a href="https://data.seoul.go.kr/dataList/OA-15493/A/1/datasetView.do" target="_blank" rel="noopener noreferrer">따릉이 · 서울 열린데이터광장</a></dt><dd>{stationData?.center===start.id?`서버 조회 ${formatWeatherTime(stationData.fetchedAt)}`:stationLoading?"조회 중":"조회 실패"}<small>원천 측정시각 미제공 · 최대 60초 캐시 · 대수 변동 가능</small></dd></div>
          <div><dt><a href="https://developers.kakao.com/docs/ko/kakaomap/rest-api" target="_blank" rel="noopener noreferrer">자전거 경로 · 카카오맵</a></dt><dd>{routeResult?.key===routeKey?`서버 조회 ${formatWeatherTime(routeResult.fetchedAt)}`:routeLoading?"조회 중":"조회 결과 없음"}<small>조회 시점 경로·거리·예상시간 · 실제 이동 측정값 아님</small></dd></div>
          <div><dt><a href={ACCIDENT_SOURCE_URL} target="_blank" rel="noopener noreferrer">사고다발지역 · 한국도로교통공단/TAAS</a></dt><dd>{accidentData?`${accidentData.meta.year}년 사고 통계 · 서버 조회 ${formatWeatherTime(accidentData.meta.fetchedAt)}`:accidentLoading?"조회 중":"확인 불가"}<small>과거 연간 자료 · 최대 24시간 캐시 · 실시간 사고 아님</small></dd></div>
          <div><dt><a href="https://www.data.go.kr/data/15084084/openapi.do" target="_blank" rel="noopener noreferrer">단기예보 · 기상청</a></dt><dd>{forecast?<>발표 {formatWeatherTime(forecast.issuedAt)}<br />예보 대상 {formatWeatherTime(forecast.forecastAt)}<br />서버 조회 {formatWeatherTime(weather!.fetchedAt)}</>:weatherLoading?"조회 중":"확인 불가"}<small>출발지 격자 예보 · 최대 10분 캐시 · 관측값 아님</small></dd></div>
        </dl><p>시각은 월·일·시·분으로 표시합니다. 원천 측정시각과 서버 조회시각은 다르며 네 정보는 동시에 측정된 자료가 아닙니다.</p></details>
        <section className="weather-card"><div className="section-heading"><h2>출발지 단기예보</h2><span className="small-badge">기상청</span></div>
          <p className="card-subtitle">{start.name} 주변 격자 기준</p>
          {weatherLoading && <p role="status">기상청 예보를 조회하고 있습니다.</p>}
          {weatherError && <p role="alert" className="station-error">{weatherError}</p>}
          {forecast && <><div className="weather-main"><span aria-hidden="true">℃</span><div><b>{forecast.temperature}°C</b><p>기온 예보 · 현재 관측값이 아닙니다</p></div></div>
            <div className="weather-details"><span>강수확률 <b>{forecast.precipitationProbability}%</b></span><span>격자 <b>{forecast.grid.nx}, {forecast.grid.ny}</b></span></div>
            <dl className="forecast-times"><div><dt>발표시각</dt><dd>{formatWeatherTime(forecast.issuedAt)} KST</dd></div><div><dt>예보시각</dt><dd>{formatWeatherTime(forecast.forecastAt)} KST</dd></div></dl>
            <p>발표시각은 예보를 발표한 때, 예보시각은 기온·강수확률이 적용되는 때입니다.</p></>}
          <button className="accident-retry" disabled={weatherLoading} onClick={()=>setWeatherRefresh(n=>n+1)}>날씨 새로고침</button>
          <a className="weather-source" href="https://www.data.go.kr/data/15084084/openapi.do" target="_blank" rel="noopener noreferrer">출처: 기상청 단기예보</a>
        </section>
        <footer>이 화면은 경로의 실제 안전성을 평가하거나 보장하지 않습니다.</footer>
      </aside>
      <main className="map-panel" id="ride-map">
        <BikeMap start={start} end={end} bikes={bikes} safety={safety} cyclingRoute={currentRoute} accidentZones={accidentZones} nearZoneIds={nearZoneIds} stations={stations} selectedStation={station} onStation={selectStation} />
        <div className="map-toolbar"><div className="map-title"><span className="live-dot" /><b>서울 라이딩 지도</b><span>통합 이동정보</span></div><div className="layer-controls"><button className={bikes ? "active" : ""} aria-pressed={bikes} onClick={() => setBikes(!bikes)}>♧ 따릉이 대여소</button><button className={safety ? "active safety" : ""} aria-pressed={safety} onClick={() => setSafety(!safety)}>△ 과거 사고다발지역</button></div></div>
        <div className="map-bottom">
          {bikes && <section className="floating-card station-card"><div className="section-heading"><h2>출발지 주변 따릉이</h2><span className="small-badge">서울시</span></div>
            <p className="card-subtitle">{start.name} 기준 · 직선거리순 최대 20곳</p>
            <div className="station-controls"><label>검색 반경 <select value={radius} onChange={e => setRadius(Number(e.target.value))}><option value={500}>500 m</option><option value={1000}>1 km</option><option value={2000}>2 km</option><option value={5000}>5 km</option></select></label><button onClick={() => setRefresh(n => n + 1)} disabled={stationLoading}>새로고침</button></div>
            {stationLoading && <p role="status">서울시 대여소를 조회하고 있습니다.</p>}
            {stationError && <p className="station-error" role="alert">{stationError} 새로고침으로 다시 시도해 주세요.</p>}
            {!stationLoading && !stationError && stations.length === 0 && <p role="status">반경 안에 대여소가 없습니다. 검색 반경을 넓혀보세요.</p>}
            <div className="station-list">{stations.map(s => <button key={s.id} onClick={() => setStation(s.id)} className={station === s.id ? "selected-station" : ""} aria-pressed={station === s.id}><span className="station-icon">♧</span><span>{s.name}<small className="station-distance">{s.distanceMeters < 1000 ? `${s.distanceMeters} m` : `${(s.distanceMeters / 1000).toFixed(2)} km`} · 직선거리</small></span><b>{s.bikes}<small>대</small></b></button>)}</div>
            {selectedStation && <div className="station-summary">{selectedStation.name} · <b>{selectedStation.bikes}대 대여 가능</b></div>}
            {stationData && !stationError && <p className="station-timestamp">조회 {new Date(stationData.fetchedAt).toLocaleTimeString("ko-KR", { timeZone: "Asia/Seoul" })} · 최대 60초 캐시<br />대수는 조회 이후 달라질 수 있습니다.</p>}
          </section>}
          {safety && <section className="floating-card accident-card"><div className="section-heading"><h2><span className="warning-icon">△</span> 과거 사고다발지역</h2><span className="small-badge">{accidentData ? `${accidentData.meta.year}년` : "조회 전"}</span></div>
            <p className="accident-note">실시간 사고가 아닌 과거 연간 사고 통계입니다.</p>
            <p className="card-subtitle">공식 안내 최신 제공연도: {DOCUMENTED_LATEST_ACCIDENT_YEAR}년{accidentData ? ` · 실제 조회: ${accidentData.meta.year}년 서울 ${accidentData.data.length}곳` : " · 실제 응답 미확인"}</p>
            {accidentLoading && <p role="status">서울 사고다발지역을 조회하고 있습니다.</p>}
            {accidentError && <p className="station-error" role="alert">{accidentError}</p>}
            <button className="accident-retry" onClick={()=>setAccidentRefresh(n=>n+1)} disabled={accidentLoading}>다시 조회</button>
            {accidentData && <><p className="card-subtitle">{currentRoute ? `선택 경로 중심선 300m 이내 ${nearAccidents.length}곳` : "경로를 조회하면 가까운 사고지역을 확인할 수 있습니다."}</p>
              <div className="accident-list">{nearAccidents.map(a=><div className="accident-item" key={a.id}><strong>{a.name}</strong><p>경로까지 약 {Math.round(a.distanceMeters)}m · 사고 {a.accidents}건<br />사상자 {a.casualties}명 · 사망 {a.deaths}명 · {a.year}년 기준</p></div>)}</div>
              {currentRoute && nearAccidents.length===0 && <p className="card-subtitle">해당 기준의 과거 사고다발지역이 없습니다. 현재 경로의 안전을 보장하지 않습니다.</p>}
              <p className="accident-note">지역 중심점에서 경로 선분까지의 최단 직선거리 기준입니다. 빨강은 경로 주변, 주황은 그 외 서울 지역입니다.</p></>}
            <a className="accident-source" href={ACCIDENT_SOURCE_URL} target="_blank" rel="noopener noreferrer">출처: 한국도로교통공단 · TAAS</a>
          </section>}
        </div>
      </main>
    </div>
  </div>;
}







