# Safe Bike Seoul

Next.js + TypeScript 기반 자전거 지도 웹앱입니다.

GitHub 업로드·Vercel 환경변수·카카오 허용 도메인 설정은 [DEPLOYMENT.md](./DEPLOYMENT.md)를 참고하세요. Node.js 26.x를 사용합니다.

## 실행과 인증키

```powershell
npm.cmd install
npm.cmd run dev
```

http://127.0.0.1:3000 에서 확인합니다. 프로젝트 루트의 `.env`에 아래 항목을 설정합니다. `.env.local`과 운영체제 환경변수는 `.env`보다 우선합니다. 변경 후 서버를 재시작하세요.

```dotenv
API_DATA_MODE=demo
SEOUL_API_KEY=
DATA_GO_KR_API_KEY=
KMA_SERVICE_KEY=
KAKAO_REST_API_KEY=
NEXT_PUBLIC_KAKAO_MAP_KEY=
SEOUL_ALLOW_HTTP=true
```

실제 키는 `.env`에만 저장하고 `.env.example`에는 넣지 마세요. `.env*`와 로그는 Git에서 제외하며 빈 `.env.example`만 공유합니다. 서버 키는 `src/lib/server/env.ts`에서 읽고 `server-only` 경계로 클라이언트 가져오기를 차단합니다. 응답·props·로그에 서버 키나 원본 API 오류를 전달하지 않습니다. 이미 Git 이력에 키를 올렸다면 해당 키를 폐기·재발급해야 합니다.

`NEXT_PUBLIC_KAKAO_MAP_KEY`는 브라우저용 JavaScript 공개 키입니다. REST API 키와 분리하고 카카오 콘솔에 `http://127.0.0.1:3000`, `http://localhost:3000`을 허용 도메인으로 등록하세요. SDK 키가 없거나 지도 연결이 실패하면 예시 배경 지도를 표시하되 실제 대여소 마커는 잘못된 위치에 그리지 않습니다. 실제 대여소 목록은 지도 SDK와 독립적으로 조회됩니다.

## 실제 따릉이 대여소

대여소는 `API_DATA_MODE`와 관계없이 서울 열린데이터광장 `bikeList`만 사용합니다. 가상 대여소 데이터와 대체 응답은 제거했습니다. 서버가 1,000건씩 빈 페이지 또는 1,000건 미만 페이지까지 조회하며, `list_total_count`를 서울 전체 개수라고 가정하지 않습니다. 모든 페이지가 성공해야 결과를 사용합니다.

- 서울시 위치 좌표와 `parkingBikeTotCnt`를 카카오 지도 마커와 대여소 목록에 표시합니다.
- 출발지 변경 시 전체 대여소 중 반경 내의 대여소를 Haversine 직선거리순으로 최대 20곳 표시합니다.
- 반경 500m, 1km, 2km, 5km 선택과 새로고침을 지원합니다.
- 자전거 0대인 대여소도 실제 수량 그대로 표시합니다.
- 동시 조회는 합치고 서버에서 최대 60초 캐시합니다. 화면에 서버 조회 시각을 표시합니다. 새로고침도 유효한 60초 캐시는 재사용합니다.
- 실패 시 오류, 결과가 없으면 빈 결과를 표시하며 가상 대여소로 대체하지 않습니다.

서울시 공식 주소는 `http://openapi.seoul.go.kr:8088/{KEY}/json/bikeList/{START}/{END}/`입니다. 실제 확인 시 8088 포트는 TLS를 지원하지 않았습니다. `SEOUL_ALLOW_HTTP=true`로 공식 HTTP 주소를 서버에서 호출합니다. 브라우저/Git에 키는 노출되지 않지만 서울시로 전송되는 구간은 암호화되지 않습니다. `false`로 설정하면 HTTPS만 시도하며 현재 접속 환경에서는 실패할 수 있습니다. 인증서를 무시하거나 비공식 중계 서비스를 사용하지 않습니다.

## API

GET만 지원합니다. 성공은 `{ data, meta }`, 실패는 `{ error: { code, message } }`이며 HTTP 응답은 `no-store`입니다. 외부 요청은 고정 호스트로만 보내고 각 요청에 8초 타임아웃과 리다이렉트 차단을 적용합니다.

| 경로 | 인자 | 데이터 |
| --- | --- | --- |
| `/api/stations?lat=37.5271&lng=126.9328&radius=2000&limit=20` | lat 37~38, lng 126~128 필수; radius 100~10000m; limit 1~100 | 서울시 실제 대여소, 거리순 |
| `/api/places?query=여의도` | query 1~80자 | 예시 장소 또는 카카오 검색 |
| `/api/weather?lat=37.5271&lng=126.9328` | 출발지 위도·경도 필수 | 기상청 격자 변환 후 기온·강수확률 예보 |
| `/api/accidents` | 없음 | 최신 제공연도 서울 자전거 사고다발지역 |
| `/api/routes?stationId=ST-...&endLat=37.5097&endLng=126.9959` | 실제 대여소 ID, 목적지 위경도 | 카카오 자전거도로 우선·최단 경로 |

대여소 응답은 `id`, `name`, `lat`, `lng`, `bikes`, `racks`, `distanceMeters`를 포함합니다. `meta`에는 `source: seoul`, `isDemo: false`, `fetchedAt`, `totalStations`, `center`, `radiusMeters`, `distanceType: straight-line`, `cacheSeconds`가 있습니다. 거리는 보행/주행 거리가 아닙니다. 키 미설정 503, 입력 오류 400, 외부 API 오류 502입니다.

`API_DATA_MODE=live`는 장소검색 API만 실제 외부 호출로 전환합니다. UI의 장소검색은 예시 목록을 사용하며, 대여소·자전거 경로·과거 사고정보·기상청 단기예보는 항상 실제 API만 사용합니다. 오류 시 가상 데이터로 대체하지 않습니다.

## 검증

```powershell
# 개발 서버 실행 후
node --test scripts/test-api.mjs
node --test scripts/test-stations.mjs
node --test scripts/test-cycling-routes.mjs
node --test scripts/test-accidents.mjs
node --test scripts/test-weather.mjs
npm.cmd run build
node scripts/check-client-secrets.mjs
node scripts/test-live-config.mjs
```

대여소 검사는 거리계산/정렬/반경/제한/0대 처리 및 실제 서울 API를 사용하는 출발지 두 곳의 응답을 검증합니다. 실데이터 테스트는 키와 네트워크가 필요합니다. 키 미설정 검사는 별도 포트 3101을 사용하며 .env를 수정하지 않습니다. 비밀키 검사는 `.next/static` 및 `public`에서 설정된 서버 키의 원문과 URL 인코딩 값을 검사하며 키 값은 출력하지 않습니다.

공식 문서: [서울시 따릉이](https://data.seoul.go.kr/dataList/OA-15493/A/1/datasetView.do), [카카오 지도 SDK](https://apis.map.kakao.com/web/guide/), [카카오 장소검색](https://developers.kakao.com/docs/latest/ko/local/dev-guide#search-by-keyword), [기상청](https://www.data.go.kr/data/15084084/openapi.do).

## 카카오 공식 자전거 경로

공식 REST 엔드포인트 `https://dapi.kakao.com/v2/routing/bicycle`를 사용합니다. 제휴용 카카오모빌리티 API나 자동차 길찾기로 대체하지 않습니다. 현재 서버 REST 키로 `BIKE_ONLY`와 `SHORTEST`를 직접 호출해 HTTP 200, `status: OK`, 거리·시간 및 실제 경로 좌표 반환을 확인했습니다.

선택한 대여소 ID를 서버의 실제 서울시 목록에서 다시 확인하여 출발 좌표를 얻고, 선택한 목적지까지 두 모드를 병렬 조회합니다. `API_DATA_MODE=demo`여도 이 경로 API는 실서비스를 호출합니다. 화면은 대여소/목적지 변경 시 기존 경로를 지우고 다시 조회하며, 요청 취소로 늦게 도착한 이전 결과가 표시되는 것을 방지합니다.

성공 응답의 data는 `origin`, `destination`, `routes`를 포함합니다. 각 route의 `mode`, `distance`(m), `duration`(초), `paths`는 공식 응답에서 읽으며, 구간별 좌표를 별도 Polyline으로 표시해 구간 사이의 임의 연결선을 만들지 않습니다. 거리와 소요시간도 가상 고정값을 제거했습니다. 지도 SDK가 연결되지 않으면 예시 배경에 실제 경로를 그리지 않습니다.

두 경로 중 하나라도 실패하면 성공으로 처리하지 않고 오류를 반환합니다. 인증 실패(401), 권한 거부(403), 한도 초과(429), 연결/타임아웃, 경로 좌표 없음에 대한 이유를 구분하며 키나 원본 에러 본문은 노출하지 않습니다. HTTP 200이어도 `status`가 OK가 아니거나 경로 좌표가 없으면 실패입니다. 이때 임의 경로·고정 거리/시간으로 대체하지 않습니다.

공식 문서: https://developers.kakao.com/docs/ko/kakaomap/rest-api#bicycle-directions

## 과거 자전거 교통사고 다발지역

한국도로교통공단 공공데이터포털 API `https://apis.data.go.kr/B552061/frequentzoneBicycle/getRestFrequentzoneBicycle`를 연결했습니다. 서버의 `DATA_GO_KR_API_KEY`에 이 서비스 활용승인을 받은 공공데이터포털 키를 설정합니다. `API_DATA_MODE`와 관계없이 실제 데이터만 사용하며 가상 사고 데이터는 제거했습니다.

2026-11-20 확인 시 공단 공식 안내의 자료 제공기간은 2012~2025년입니다. 실제 API에서 2025년 서울 25개 구를 조회하여 110곳과 폴리곤 110개를 확인했습니다. 기준연도는 `afos_id` 문자열이나 조회 날짜에서 추정하지 않고 `searchYearCd`로 요청한 연도입니다. 공식 안내 최신연도 상수는 `src/lib/accidents.ts`에 관리하며 새로운 연도 공개 시 해당 안내를 확인해 갱신해야 합니다.

최신 공식 안내연도부터 내려가며 서울 전 구가 정상 조회된 연도만 채택합니다. 정상 응답의 자료 없음(03)만 빈 결과로 취급합니다. 인증·네트워크·형식 오류는 이전 연도나 가상 데이터로 대체하지 않습니다. 구별 페이지를 모두 조회하고 FID로 중복을 제거합니다. 정상 자료는 서버 메모리에 최대 24시간 캐시합니다.

응답은 `{ data: AccidentZone[], meta }`이며 `meta.year`는 실제 자료 기준연도, `documentedLatestYear`는 공식 안내의 최신연도, `checkedYears`는 확인한 연도입니다. `isDemo`는 false입니다. API 키가 없으면 `503 ACCIDENT_KEY_MISSING`을 반환하고 화면에서도 자료를 조회하지 못했다고 안내합니다. 이를 사고지역 없음으로 표현하지 않습니다.

지도에는 API의 실제 중심좌표 마커와 `geom_json` 폴리곤을 표시합니다. 선택한 자전거 경로의 **각 선분**과 다발지역 **중심점** 사이 최단 직선거리 300m 이내를 경로 주변으로 분류하고 거리순으로 보여줍니다. 서로 분리된 경로 구간 사이에는 가상의 연결선을 만들지 않습니다. 해당 계산은 서울 범위의 미터 단위 국소 평면 근사이며 도로 주행거리나 폴리곤 경계 거리가 아닙니다. 경로가 없을 때는 주변 지역이 없다고 단정하지 않습니다. 지도 SDK 미연결 시에는 예시 배경에 실제 사고지역을 그리지 않습니다.

빨간색은 경로 주변, 주황색은 그 외 서울 사고다발지역입니다. 사고건수·사상자·사망자 수와 자료 기준연도를 표시합니다. **과거 한 해의 사고 통계이며 실시간 사고, 현재 위험도 또는 경로의 안전 보장을 의미하지 않습니다.** 선정조건은 공단 최신 안내에서 반경 100m 내 자전거 사고 4건 이상(사망사고 포함 시 3건 이상)이며, 2012~2021년은 반경 200m 기준입니다. 이 반경과 앱의 경로 주변 검색 기준 300m는 별개입니다.

출처 및 자료 링크: [한국도로교통공단·TAAS 자전거 교통사고 다발지역](https://opendata.koroad.or.kr/api/selectBicycleDataSet.do), [공공데이터포털 API](https://www.data.go.kr/data/15056681/openapi.do).

## 출발지 기상청 단기예보

공공데이터포털 기상청 단기예보 서비스의 `getVilageFcst`를 사용합니다. `.env`의 `KMA_SERVICE_KEY`에 **공공데이터포털(data.go.kr)** 서비스키를 입력하세요. 비어 있으면 기존 `DATA_GO_KR_API_KEY`를 사용합니다. 기상청 API허브의 authKey는 별개이며 이 엔드포인트에 사용할 수 없습니다. 기상청 단기예보 서비스 활용승인을 받아야 합니다. 키 변경 후 서버를 재시작하세요.

서버가 출발지 위경도를 기상청 DFS/LCC 5km 격자(nx,ny)로 변환합니다. 예를 들어 여의나루역(37.5271,126.9328)은 (59,126), 서울시청(37.5665,126.978)은 (60,127)입니다. `lat`와 `lng`가 없는 요청은 400이며 클라이언트가 임의의 고정 격자로 대체하지 않습니다.

한국시간 하루 8회 발표(02·05·08·11·14·17·20·23시) 중 현재 시각에서 제공 여유 10분을 제외한 최신 발표를 선택합니다. 자정 이전/이후 날짜 전환을 처리하며, 새 발표의 응답코드가 자료 없음(03)일 때만 직전 발표를 한 번 조회합니다. 인증/권한 오류를 이전 발표 또는 예시 날씨로 대체하지 않습니다.

동일 격자·발표일시·예보일시에 대응하는 `TMP`(기온 ℃)와 `POP`(강수확률 %)를 묶어서 현재 이후 가장 가까운 예보시각을 선택합니다. 현재 관측값이 아닌 **미래 시각의 예보**입니다. 다른 시각의 기온과 강수확률을 섞지 않으며 0%와 영하 기온도 보존합니다. 서버는 발표·격자별 데이터를 최대 10분 캐시하고 요청 때마다 예보 대상 시각을 다시 선택합니다.

성공 data는 `temperature`, `precipitationProbability`, `grid`, `issuedAt`, `forecastAt`를 포함합니다. `issuedAt`은 발표시각, `forecastAt`은 예보값이 적용되는 시각이며 모두 `+09:00`이 붙은 날짜·시각입니다. 화면에 두 시각을 별도 표시합니다. `meta.fetchedAt`은 서버 조회시각으로 발표시각과 다릅니다. 출발지 변경 시 이전 값은 지우고 새 격자를 조회합니다. 관측값·맑음·풍속 가상 표시는 제거했습니다.

기상청 전용 키 설정 후 실제 조회에 성공했습니다. 2026-11-20 여의나루역 격자(59,126)에서 11:00 발표, 12:00 예보(기온 1℃·강수확률 0%)를 확인했습니다. 향후 HTTP 403이 발생하면 화면은 `WEATHER_ACCESS_DENIED`를 표시하며 서비스 활용승인과 접근 제한을 확인하도록 안내합니다.

출처: [기상청 단기예보 조회서비스](https://www.data.go.kr/data/15084084/openapi.do), [기상청 API허브 예보 발표주기 안내](https://apihub.kma.go.kr/apiList.do?seqApi=10).


## 통합 비교 화면

지도와 같은 페이지에서 따릉이 대여소, 자전거 경로 비교표, 과거 사고다발지역, 출발지 날씨를 확인합니다. 경로 비교표는 카카오의 두 경로를 같은 순서로 유지하며 거리(km), 예상시간(분), 경로 주변 300m 이내 사고다발지역 수를 나란히 보여줍니다. 같은 지역이 중복된 경우 ID로 한 번만 셉니다. 경로 선택은 지도 경로선 및 주변 사고지역 강조와 연결됩니다.

사고자료가 미조회/오류인 경우 지역 수는 `확인 불가`이며 0으로 대체하지 않습니다. 정상 조회 결과에 해당 지역이 없는 경우에만 0곳입니다. 과거 사고지역 수에 따른 안전 순위, 안전점수, 안전경로 추천을 만들지 않습니다. 과거 지역 수가 적거나 0이어도 실제 안전성을 뜻하지 않는다고 화면에 안내합니다.

‘정보 출처와 기준시각’에 네 서비스의 공식 출처 링크와 각 시각을 표시합니다. 따릉이는 원천 측정시각이 제공되지 않으므로 서버 조회시각으로 명시하고 측정시각으로 오인하지 않도록 안내합니다. 경로는 서버 조회시각, 사고정보는 기준연도와 서버 조회시각, 날씨는 발표시각·예보 대상 시각·서버 조회시각을 구분합니다. 캐시 유효기간과 네 정보가 동시에 측정된 자료가 아니라는 점도 표시합니다. 모든 표시는 KST입니다.

검증: `node --test scripts/test-comparison.mjs`는 두 경로별 독립 집계, 중복 제거, 미확인과 0곳 구분, 실제 네 서비스의 출처/시각 및 비교 결과를 확인합니다.

## 전체 앱 QA (2026-11-20)

실제 Edge(설치된 msedge, headless)에서 데스크톱 1440×1000과 360/390/768px 화면폭을 검증했습니다. 모바일 검증은 브라우저 화면폭 에뮬레이션이며 실제 휴대폰 기기 테스트는 아닙니다. 최신 스크린샷은 `artifacts/qa-desktop.png`, `artifacts/qa-mobile.png`, 브라우저 결과는 `artifacts/browser-test-results.json`에 저장됩니다.

- 실제 호출: 서울 bikeList 2,742곳, 카카오 두 자전거 경로, 한국도로교통공단 2025년 서울 110곳, 기상청 기온/강수확률, Kakao JavaScript SDK 로딩.
- Kakao 장소검색은 별도 live 모드 서버에서 실제 응답 9건 및 존재하지 않는 검색어의 빈 결과를 확인했습니다. 기존 화면의 장소 입력은 여전히 예시 장소 목록 검색입니다.
- API/계산 회귀 검사 33개, 브라우저 시나리오 15개 통과. 격리 서버의 실제 live 응답과 인증 거부·자료 없음·경로 권한 거부·경로 없음·불완전 예보 5가지 주입 시나리오도 통과했습니다. 인위적으로 주입한 오류를 실제 제공기관 장애라고 기록하지 않습니다.
- 키 미설정 503 검사, ESLint, TypeScript/프로덕션 빌드, 공개 정적 파일의 서버 키 미포함 검사를 통과했습니다.

수정 내용: 모바일 데이터 카드를 지도 아래에 배치하고 지도 바로가기 추가, 모바일 제목 띄어쓰기 개선, 마커를 대수/사고건수 중심으로 축약하고 전체 이름은 접근성 이름/툴팁으로 제공, 0대 마커 구분, 데이터 갱신 시 지도 인스턴스 재사용 및 오버레이 정리, 화면 크기 변경 시 지도 범위 재조정, SDK 타임아웃 정리, 취소된 초기 요청의 상태 갱신 방지, Hook 의존성/Next Link 검사 오류 수정, 외부 HTTP 401/403/429 및 서울 인증 오류의 안내 구분. 개발 서버의 과거 모듈 캐시는 소유한 서버 재시작으로 해소했습니다.

재실행 방법(앱이 3000번 포트에서 실행 중이어야 함):

```powershell
node --test scripts/test-api.mjs scripts/test-stations.mjs scripts/test-cycling-routes.mjs scripts/test-accidents.mjs scripts/test-weather.mjs scripts/test-comparison.mjs
node scripts/test-browser.mjs
npx.cmd eslint src scripts
npm.cmd run build
node scripts/test-provider-cases.mjs
node scripts/test-live-config.mjs
node scripts/check-client-secrets.mjs
```

브라우저 테스트는 설치된 Edge를 사용합니다. 격리 서버 테스트는 3101/3102 포트를 사용하고 종료 시 자신이 실행한 서버만 종료합니다. `scripts/provider-fixture.mjs`는 테스트 자식 프로세스의 `--import`에만 사용하며 애플리케이션에서 가져오지 않습니다. API 키, 인증 헤더 또는 전체 네트워크 추적 파일을 결과물에 저장하지 않습니다.

