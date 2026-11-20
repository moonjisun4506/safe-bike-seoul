# GitHub 업로드와 Vercel 배포

이 문서는 준비된 소스를 사용자가 GitHub와 Vercel에 올리는 절차입니다. 원격 저장소 생성, push, 실제 배포는 아직 수행하지 않았습니다.

## 1. 업로드할 폴더

`safe-bike-seoul` 폴더 자체를 저장소 루트로 사용하세요. 상위 `따릉이` 폴더에는 별도 `.env`가 있으므로 상위 폴더 전체를 업로드하지 마세요. Git main 브랜치를 로컬에 초기화했으며 아직 커밋과 원격 저장소는 없습니다.

공유할 파일은 `src/`, `public/`, `scripts/`, package.json/package-lock.json, Next.js/TypeScript/ESLint 설정, vercel.json, 이 문서와 README, **값이 비어 있는 `.env.example`**입니다. `.env*` 실파일, 인증서/개인키, `.next`, node_modules, Vercel 로컬 상태, 로그, QA 스크린샷은 `.gitignore` 및 `.vercelignore`에서 제외했습니다. `.env`는 GitHub 웹 업로드에도 직접 선택하지 마세요. GitHub 웹 파일 업로드는 로컬 .gitignore 적용을 보장하지 않습니다.

## 2. GitHub 업로드

프로젝트 폴더의 PowerShell에서:

```powershell
npm.cmd run check:repo
# 결과가 PASS인 것을 확인한 다음
 git add .
 git diff --cached --name-only
 npm.cmd run check:repo
 git commit -m "Prepare Safe Bike Seoul for deployment"
```

GitHub에서 빈 저장소를 만들고 아래의 사용자명/저장소명을 본인 것으로 변경하세요.

```powershell
git remote add origin https://github.com/YOUR_USERNAME/safe-bike-seoul.git
git push -u origin main
```

Git 인증은 GitHub 로그인/자격 증명 관리자를 사용하고 토큰을 remote URL이나 소스에 넣지 마세요. Git 사용자 정보 미설정으로 commit이 실패하면 본인의 이름과 이메일을 저장소 범위에 설정하세요. 이미 remote가 있으면 새로 추가하지 말고 `git remote -v`로 확인합니다. 이전 이력에 키를 올린 적이 있다면 ignore 추가만으로 없어지지 않으므로 키를 폐기·재발급해야 합니다.

`check:repo`는 Git이 추적하거나 업로드 후보로 보는 파일에서 로컬에 설정된 실제 키(공개 JavaScript 키 포함)의 원문/URL 인코딩 값과 비공개 파일을 검사합니다. 키 값을 출력하지 않습니다. 로컬에 설정하지 않은 모든 종류의 비밀키까지 검출하는 범용 검사는 아닙니다.

## 3. Vercel 프로젝트 설정

Vercel에서 Add New → Project → GitHub 저장소 Import를 선택합니다.

| 항목 | 설정 |
| --- | --- |
| Framework Preset | Next.js |
| Root Directory | 저장소 루트가 이 폴더라면 기본값; 상위 저장소라면 `safe-bike-seoul` |
| Node.js Version | **26.x** (`package.json` engines와 `.nvmrc`에 명시) |
| Install Command | `npm ci` |
| Build Command | `npm run build` |
| Output Directory | Next.js 기본값 사용; `out`으로 바꾸지 않음 |

`vercel.json`이 프레임워크와 설치/빌드 명령을 명시합니다. API Route가 필요하므로 정적 export로 배포하지 마세요. API 실행시간 예산은 사고정보 120초, 대여소/경로 60초, 날씨 30초, 장소검색 15초로 설정했습니다. 실제 플랫폼/요금제 제한을 확인하세요. 브라우저 QA는 로컬 Edge를 사용하는 별도 작업이며 Vercel Build Command에 넣지 않습니다.

공식 안내: [Vercel Node 버전](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions), [API 실행시간](https://vercel.com/docs/functions/configuring-functions/duration).

## 4. 배포 환경변수

Vercel Project → Settings → Environment Variables에 아래 항목을 각각 등록합니다. 값을 이 문서나 GitHub 파일에 적지 마세요. 우선 Production에 등록하고 Preview가 필요한 경우 신뢰할 수 있는 Preview 환경에 별도로 설정합니다. `.env` 자체를 업로드하지 않습니다.

| 이름 | 넣을 값 | 노출 범위 |
| --- | --- | --- |
| `SEOUL_API_KEY` | 서울 열린데이터광장 bikeList 인증키 | 서버 전용 |
| `DATA_GO_KR_API_KEY` | 공공데이터포털 자전거 사고다발지역 활용승인 키 | 서버 전용 |
| `KMA_SERVICE_KEY` | 공공데이터포털 기상청 단기예보 활용승인 키 | 서버 전용 |
| `KAKAO_REST_API_KEY` | 자전거 경로/장소검색 권한이 확인된 Kakao REST 키 | 서버 전용 |
| `NEXT_PUBLIC_KAKAO_MAP_KEY` | Kakao JavaScript SDK 키 | 브라우저 공개용 |
| `SEOUL_ALLOW_HTTP` | `true` | 비밀 아님 |
| `API_DATA_MODE` | `live` | 비밀 아님; `/api/places`에만 영향 |

기상청 API허브(apihub.kma.go.kr)의 authKey가 아닌 **data.go.kr** 서비스키를 사용합니다. `KMA_SERVICE_KEY`가 비어 있으면 `DATA_GO_KR_API_KEY`를 쓰지만 두 서비스 모두 활용승인이 필요합니다. data.go.kr의 디코딩/URL 인코딩 키 모두 처리하며 Vercel 입력란에는 따옴표 없이 키만 넣으세요.

서버 키에는 `NEXT_PUBLIC_`를 붙이거나 next.config.ts의 `env`에 넣지 마세요. JavaScript SDK 키는 지도 로딩 때 브라우저에서 보이는 공개용 키이므로 REST 키와 달리 숨길 수 없습니다. 원본 키 값은 GitHub 소스에는 저장하지 않습니다.

환경변수 저장 후 **새 Deployment 또는 Redeploy**가 필요합니다. 특히 `NEXT_PUBLIC_KAKAO_MAP_KEY`는 빌드 시 브라우저 코드에 반영되므로 변경 후 반드시 다시 빌드·배포하세요. 앱이 이미 표시된 상태에서 환경변수만 바꿔도 기존 배포가 바뀌지는 않습니다. [Vercel 환경변수 관리](https://vercel.com/docs/environment-variables/managing-environment-variables)

## 5. 카카오 허용 도메인

Kakao Developers에서 앱 → 플랫폼 키 → **JavaScript 키 → JavaScript SDK 도메인**에 실제 사용하는 주소를 등록합니다.

```text
http://localhost:3000
http://127.0.0.1:3000
https://YOUR_PROJECT.vercel.app
https://YOUR_CUSTOM_DOMAIN
```

예시 주소를 그대로 등록하지 말고 실제 Production 주소/사용자 도메인으로 바꾸세요. 프로토콜과 포트까지 맞추고 페이지 경로는 넣지 않습니다. Preview 주소가 Production 주소와 다르면 테스트할 Preview 도메인도 별도 등록해야 합니다. 앱의 카카오맵 사용 설정과 JavaScript 키가 맞는지도 확인하세요.

이 앱은 카카오 로그인을 사용하지 않으므로 로그인 Redirect URI는 지도 로딩을 위한 설정이 아닙니다. REST API 키의 **호출 허용 IP 주소**도 JavaScript SDK 도메인과 별개입니다. IP 제한을 사용한다면 실제 Vercel 서버의 고정 egress 구성을 먼저 확인해야 하며 `vercel.app` 도메인의 DNS IP를 서버의 외부 호출 IP로 등록하면 안 됩니다. 로컬 키가 성공해도 배포 서버 IP 제한으로 거부될 수 있습니다.

공식 안내: [카카오 지도 SDK](https://apis.map.kakao.com/web/guide/), [카카오 앱·키 설정](https://developers.kakao.com/docs/ko/app-setting/app).

## 6. 배포 후 확인

1. Production URL에서 지도 타일이 표시되는지 확인합니다. 지도만 실패하면 JavaScript 키와 정확한 허용 도메인을 확인합니다.
2. 대여소 대수/검색 반경, 두 자전거 경로선과 비교표, 2025년 기준 과거 사고정보, 날씨 기온·강수확률 및 발표/예보시각을 확인합니다.
3. `/api/stations?lat=37.5271&lng=126.9328`, `/api/accidents`, `/api/weather?lat=37.5271&lng=126.9328`, `/api/places?query=여의나루역`의 성공 응답을 확인합니다. 경로 API는 stations 응답의 실제 id로 `/api/routes?stationId=ID&endLat=37.5097&endLng=126.9959`를 호출합니다.
4. 401/403은 키·활용승인·IP 제한, 429는 호출 한도, 502/503은 화면의 오류 코드를 확인합니다. 원본 URL/인증 헤더/키를 캡처해 공유하지 마세요.

현재 서울시 공식 API는 HTTP 8088 포트입니다. 로컬에서는 실제 접속을 확인했지만 Vercel의 outbound 연결 및 제공기관 정책은 실제 배포 후 확인해야 합니다. 브라우저와 Vercel 사이가 HTTPS여도 Vercel→서울시 구간은 암호화되지 않습니다.

메모리 캐시는 Vercel 함수 인스턴스 간 공유되거나 재시작 후 보존되지 않습니다. cold start와 분산 인스턴스로 외부 호출 횟수가 로컬보다 늘 수 있습니다. 공개 API에는 앱 사용자 인증/분산 호출 제한을 추가하지 않았으므로 공개 운영 시 제공기관 쿼터와 트래픽을 확인하세요. 경로/사고지역 비교는 실제 안전성을 보장하지 않습니다.

## 로컬 검증

```powershell
npm.cmd run check:repo
npm.cmd run lint
npm.cmd run build
npm.cmd run check:client
```

로컬 프로덕션 빌드 성공은 Vercel 배포 및 원격 제공기관 연결 성공과 별개입니다. 실제 배포 전후에 위의 Production URL 검사를 수행하세요.
