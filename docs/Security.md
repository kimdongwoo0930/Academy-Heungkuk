# 🔐 보안 구조 (인증 · 인가 · 설정)

> 이 문서는 "지금 이 시스템의 로그인/토큰/권한이 **어떻게** 동작하고 **왜** 그렇게 만들었는지"를 정리한 것입니다.
> 2026-09-27 보안 작업 기준 — 1단계(설정 강화, PR #94) + 2단계(토큰 구조 개선, `feature/token-cookie-rotation`)

---

## 한눈에 보기

```
[브라우저]                                               [API 서버 api.academy-hk.com]
 ├ access 토큰  → JS 메모리(zustand)   ──Authorization: Bearer──▶  JwtAuthenticationFilter (type=access 만 인증)
 │   30분, 새로고침하면 사라짐
 └ refresh 토큰 → HttpOnly 쿠키        ──Cookie (Path=/v1/auth)──▶  /v1/auth/reissue, /v1/auth/logout
     30일, JS 가 읽을 수 없음                                         │
                                                                     ▼
                                                     refresh_token 테이블 (로그인 1회 = 1행)
                                                     token_hash = SHA-256(현재 refresh 토큰)
```

| 핵심 원칙 | 구현 |
| --- | --- |
| 오래 사는 토큰은 JS 가 절대 만지지 못하게 | refresh = HttpOnly 쿠키 |
| JS 가 만지는 토큰은 짧게 | access = 30분, 메모리 보관 |
| DB 가 털려도 토큰으로 못 쓰게 | refresh 는 SHA-256 해시로만 저장 |
| 훔친 refresh 는 한 번 쓰면 끝 | 재발급마다 refresh 교체 (rotation) |
| 기기별로 독립 | 로그인마다 세션 1행, 다른 기기와 서로 덮어쓰지 않음 |
| 계정 상태가 바뀌면 전부 끊기 | 비밀번호·권한 변경, 계정 삭제 → 그 계정 모든 세션 삭제 |

---

## 1. 토큰 구조 (JWT, HS256)

|  | access 토큰 | refresh 토큰 |
| --- | --- | --- |
| 용도 | 모든 API 호출 | 재발급(`/v1/auth/reissue`), 로그아웃 |
| 만료 | **30분** (`jwt.access-expiration=1800000`) | **30일** (`jwt.refresh-expiration=2592000000`) |
| 보관 (프론트) | zustand 메모리 (`store/auth.ts`) | HttpOnly 쿠키 (브라우저가 관리) |
| 전송 | `Authorization: Bearer ...` 헤더 | 쿠키 자동 첨부 (`Path=/v1/auth` 요청만) |
| 서버 저장 | 저장 안 함 (stateless) | `refresh_token` 테이블에 **해시만** 저장 |

### 클레임

| 클레임 | access | refresh | 의미 / 이유 |
| --- | --- | --- | --- |
| `sub` | ✅ | ✅ | 로그인 아이디(userId) |
| `role` | ✅ | ❌ | `ROLE_ADMIN` / `ROLE_USER` — 필터가 권한으로 사용 |
| `type` | `access` | `refresh` | **토큰 혼용 방지**. 둘 다 같은 키로 서명되므로, 종류를 적어두지 않으면 refresh(30일)를 access 자리에 넣어 API 를 호출하는 게 가능해진다 |
| `sid` | ❌ | ✅ | 로그인 세션(기기) ID = `refresh_token.session_id`. rotation 해도 유지 |
| `jti` | ❌ | ✅ | 매번 다른 UUID. `iat`/`exp` 가 **초 단위**라 같은 초에 재발급하면 토큰이 완전히 같아져 rotation 이 무력화되는 문제 방지 |
| `iat`, `exp` | ✅ | ✅ | 발급/만료 시각 |

- 검증 메서드는 **종류까지 확인하는 것만** 존재: `JwtProvider.isAccessToken()` / `isRefreshToken()`
  (종류 확인 없는 범용 `validateToken` 은 실수로 쓰이지 않도록 제거함)
- 만료 시간은 `application.properties` 에 고정. `.env` / compose 환경변수로 바꾸지 않는다
  (Spring 은 환경변수가 설정 파일보다 우선이라, compose 에서 넘기면 고정값이 덮어써짐 → compose 연결 제거함)

---

## 2. refresh 토큰 쿠키

```
Set-Cookie: refreshToken=<JWT>; Path=/v1/auth; Max-Age=2592000; HttpOnly; SameSite=Strict; Secure(운영만)
```

| 속성 | 값 | 이유 |
| --- | --- | --- |
| `HttpOnly` | ✔ | JS(`document.cookie`)로 읽기/쓰기/삭제 불가 → XSS 로 탈취 불가 |
| `Secure` | 운영 ✔ / 로컬 ✘ | HTTPS 에서만 전송. 로컬은 `http://localhost` 라 끔 (`app.auth.cookie-secure`) |
| `SameSite` | `Strict` | 다른 사이트에서 시작된 요청엔 쿠키가 안 붙음 → CSRF 차단 |
| `Path` | `/v1/auth` | reissue / logout 요청에만 실림. 일반 API 에는 refresh 가 실려 다니지 않음 |
| `Max-Age` | 30일 | refresh 만료와 동일 |

- 쿠키 생성/만료는 **`RefreshTokenCookieProvider` 한 곳에서만** 한다. 로그아웃 시 이름·Path 가 발급 때와 하나라도 다르면 브라우저가 다른 쿠키로 보고 지우지 않기 때문.
- **SameSite=Strict 여도 동작하는 이유**: 프론트(`academy-hk.com`)와 API(`api.academy-hk.com`)는 origin 은 다르지만 등록 도메인이 같아 **same-site** 로 취급된다. 로컬 `localhost:3000` ↔ `localhost:8888` 도 포트만 달라 same-site.
- **다른 origin 으로 쿠키를 주고받기 위한 조건** (둘 다 필요)
  - 프론트: axios `withCredentials: true` — 없으면 브라우저가 `Set-Cookie` 를 무시하고 요청에 쿠키도 안 붙임
  - 서버: CORS `Access-Control-Allow-Credentials: true` + **정확한 origin** (`*` 불가) → 1단계 CORS 작업이 이 조건

---

## 3. 로그인 세션 — `refresh_token` 테이블

| 컬럼 | 설명 |
| --- | --- |
| `id` | PK |
| `account_id` | FK → `account.id` |
| `session_id` | UUID, unique. 로그인 시 생성, refresh 토큰의 `sid` |
| `token_hash` | **현재 유효한** refresh 토큰의 SHA-256 (64자 hex). 재발급마다 교체 |
| `expires_at` | 이 세션 refresh 의 만료 시각 |
| `created_at` / `updated_at` | 로그인 시각 / 마지막 재발급 시각 (BaseTimeEntity) |

- **로그인 1회 = 1행** → PC, 아이패드, 시크릿 창 등 여러 기기에서 동시에 로그인해도 서로 영향 없음
  (같은 브라우저의 탭들은 쿠키를 공유하므로 하나의 세션)
- **해시로 저장하는 이유**: DB(백업, SQL 인젝션, 내부 접근)가 유출돼도 원문이 없으니 재발급에 쓸 수 없다. 비밀번호를 BCrypt 로 저장하는 것과 같은 원리.
- **BCrypt 가 아니라 SHA-256 인 이유**
  - BCrypt 는 입력의 앞 72바이트만 사용 → JWT 는 앞부분(헤더, sub, type)이 거의 같아 다른 토큰이 같은 해시로 판정될 수 있음
  - refresh 토큰은 추측 불가능한 긴 값이라 느린 해시가 필요 없음, SHA-256 은 같은 입력 = 같은 결과라 바로 비교 가능
- 비교는 `MessageDigest.isEqual` (항상 끝까지 비교하는 상수 시간 비교) — `TokenHashUtil.matches()`
- 로그인할 때 그 계정의 **만료된 세션 행을 정리**해 쌓이지 않게 함

### 세션이 삭제되는 경우

| 이벤트 | 삭제 범위 | 결과 |
| --- | --- | --- |
| 로그아웃 | **이 기기** 세션만 | 다른 기기 유지 |
| 비밀번호 변경 (관리자가 변경 / 본인 변경) | 그 계정 **모든** 세션 | 모든 기기 로그아웃 (탈취된 refresh 도 무효화) |
| 권한 변경 (실제로 바뀐 경우만) | 그 계정 모든 세션 | 새 권한이 담긴 토큰으로 재로그인 |
| 계정 삭제 | 그 계정 모든 세션 (FK 때문에 먼저 삭제) | – |
| 만료 | 다음 로그인 때 정리 | – |

> 세션이 삭제돼도 이미 발급된 access 토큰은 만료(최대 30분)까지 유효합니다 → [알려진 한계](#10-알려진-한계--추후-검토)

---

## 4. 인증 흐름

### 4-1. 로그인 — `POST /v1/auth/login`
1. 아이디/비밀번호 확인 (실패 시 [7-1](#7-1-로그인-실패-응답-통일))
2. 새 `session_id` 생성 → access + refresh(`sid` 포함) 발급
3. 그 계정의 만료된 세션 정리 → 세션 1행 저장 (`token_hash = SHA-256(refresh)`)
4. 응답: 바디 `{"accessToken": ...}` + `Set-Cookie: refreshToken=...`
5. 프론트: access 를 메모리에 저장 → `/dashboard`

### 4-2. API 호출
- axios 요청 인터셉터가 메모리의 access 를 `Authorization` 헤더에 첨부
- `JwtAuthenticationFilter` 가 `isAccessToken()` 통과 시에만 SecurityContext 에 인증 저장 (refresh 를 넣으면 인증 안 됨)

### 4-3. access 만료 → 재발급 (rotation) — `POST /v1/auth/reissue`
```
API 401 ─▶ axios 응답 인터셉터 ─▶ refreshAccessToken() ─▶ POST /v1/auth/reissue (쿠키 자동 첨부)
                                                              │ 200: 새 access(바디) + 새 refresh(Set-Cookie)
                                                              ▼
                                   메모리 토큰 교체 ─▶ 실패했던 원래 요청 재시도
                                   (재발급 실패 시 메모리 비우고 /auth/login)
```
서버 처리 순서 (`AuthService.reissue`):
1. `isRefreshToken()` — 쿠키 없음 / 만료 / 위조 / access 토큰 → 401
2. `sid` 로 세션 조회 — 없으면(로그아웃·비밀번호 변경·삭제·만료 정리) → 401
3. 세션의 계정 = 토큰의 userId 인지 → 아니면 401
4. `TokenHashUtil.matches(토큰, token_hash)` — **이미 교체된 옛 토큰**이면 401 + WARN 로그
5. 같은 `sid` 로 새 refresh 발급 → `token_hash`, `expires_at` 교체 → 새 access + 새 refresh 반환

- 실패 사유는 외부에 드러내지 않도록 **전부 `INVALID_REFRESH_TOKEN`(401)** 로 통일
- **rotation 효과**: 재발급할 때마다 refresh 가 바뀌므로 옛 refresh 는 한 번 교체되면 다시 못 쓴다
- **재사용 감지 시 강제 로그아웃은 하지 않음** (의도된 선택). 거부 + WARN 로그만 남기고, 탈취가 의심되면 **비밀번호 변경**으로 모든 세션을 끊는다

### 4-4. 새로고침 / 새 탭
- 메모리 access 가 사라짐 → `app/(admin)/layout.tsx` 가 `refreshAccessToken()` 으로 먼저 받아온 뒤 화면 렌더링, 실패하면 `/auth/login`
- **토큰 준비 전에는 아무것도 렌더링하지 않는다**: React 는 자식 effect 를 부모보다 먼저 실행하므로, 먼저 그리면 `AdminGuard`(설정·문서 페이지)가 빈 토큰으로 "관리자 아님" 판단 후 튕겨버림

### 4-5. 로그아웃 — `POST /v1/auth/logout`
- 서버: 쿠키의 refresh 가 **현재 유효한 토큰일 때만** 그 세션 삭제 (옛 토큰으로 남의 세션을 끊지 못하게)
- 쿠키가 없거나 무효여도 **항상 200 + 쿠키 만료**(`Max-Age=0`, 같은 Path) — HttpOnly 쿠키는 JS 로 지울 수 없어서 서버가 만료시켜야 하고, 로그아웃이 실패하면 쿠키를 지울 방법이 없어짐
- 프론트: API 호출(실패해도) → 메모리 비움 → `/auth/login`
- 본인 비밀번호 변경 성공 시: "다시 로그인해주세요" 안내 → 같은 로그아웃 흐름 (서버가 이미 모든 세션을 삭제했기 때문)

---

## 5. 프론트엔드 처리

| 파일 | 역할 |
| --- | --- |
| `client/store/auth.ts` | access 토큰 + (토큰에서 꺼낸) userId, role 메모리 보관 |
| `client/lib/api/instance.ts` | axios 인스턴스, 인터셉터, `refreshAccessToken()` |
| `client/lib/utils/auth.ts` | `isAdmin()`, `getCurrentUserId()` 등 — 메모리 기준 |
| `client/lib/utils/jwt.ts` | JWT payload 디코딩 (서명 검증 없음, 화면 표시용) |
| `client/app/(admin)/layout.tsx` | 새로고침 시 재발급 후 렌더링 |
| `client/components/layout/ProfileDropdown.tsx` | 로그아웃, 본인 비밀번호 변경 후 재로그인 |
| `client/app/auth/login/page.tsx` | 로그인 후 메모리 저장 |

### axios 재발급 규칙 (`lib/api/instance.ts`)
- `withCredentials: true` (쿠키 송수신)
- 401 이면 **1회만** 재발급 후 원래 요청 재시도 (`_retry` 플래그)
- `/v1/auth/login`, `/v1/auth/reissue`, `/v1/auth/logout` 의 401 은 재시도하지 않음 (결과 그 자체이므로)
- **대기열(single-flight)**: 동시에 여러 요청이 401 이어도 `refreshPromise` 하나를 같이 기다림 → reissue 1번
- 실패한 요청이 쓴 토큰과 현재 메모리 토큰이 다르면(그 사이 다른 요청이 이미 재발급) reissue 없이 바로 재시도
- **탭 간 직렬화 (Web Locks)**: `navigator.locks.request('auth-reissue', ...)` 로 여러 탭의 reissue 를 한 번에 하나씩 → 앞 탭이 rotation 한 **최신 쿠키**로 다음 탭이 요청 (동시에 보내면 늦은 쪽이 옛 쿠키로 401)
- 재발급 기본 호출은 인스턴스가 아닌 기본 `axios` 로 (재발급 요청의 401 이 다시 인터셉터로 들어가는 무한 루프 방지)

---

## 6. 인가 (권한)

### 권한 값 — `Role` enum
- `ROLE_ADMIN`, `ROLE_USER` 만 존재 (`domain/account/entity/Role.java`)
- DB 에는 `@Enumerated(EnumType.STRING)` 으로 이름 그대로 저장 (ORDINAL 은 enum 순서가 바뀌면 권한이 뒤바뀌어 사용 안 함)
- API 응답, JWT `role` 클레임은 기존과 같은 문자열 (`role.name()`)
- 권한 변경 요청 값이 목록에 없거나 null → **400** `INVALID_ROLE`
- **마지막 관리자** 삭제·강등 → **409** `LAST_ADMIN` (관리자 0명이 되면 화면에서 복구 불가)

### URL 별 접근 규칙 (`SecurityConfig`, 위에서부터 먼저 맞는 규칙 적용)

| 경로 | 접근 |
| --- | --- |
| `/v1/auth/**`, `/v1/survey/**`, `/actuator/health`, `/actuator/prometheus` | 공개 |
| Swagger (`/swagger-ui/**`, `/v3/api-docs/**` 등) | springdoc 이 켜진 환경(로컬)에서만 공개 |
| GET 엑셀 다운로드/내보내기 (`/v1/admin/reservations/*/estimate`, `trade`, `confirmation`, `export`) | ROLE_ADMIN |
| GET `/v1/admin/**` | 로그인한 사용자 |
| PATCH `/v1/admin/accounts/me/password` | 로그인한 사용자 (본인) |
| POST / PUT / PATCH / DELETE `/v1/admin/**` | ROLE_ADMIN |
| 그 외 | 로그인한 사용자 |

프론트: `/settings`, `/document` 는 `AdminGuard`, 사이드바 메뉴는 `adminOnly` 로 숨김 (**화면 표시용일 뿐, 실제 차단은 서버**)

### 401 vs 403
| 상황 | 응답 | 처리 위치 |
| --- | --- | --- |
| 토큰 없음 / 만료 / 위조 / refresh 를 Bearer 로 | **401** `인증이 필요합니다.` | `JwtAuthenticationEntryPoint` |
| 로그인했지만 권한 부족 | **403** `접근 권한이 없습니다.` | `JwtAccessDeniedHandler` |

- Security 필터 단계의 에러라 `@RestControllerAdvice` 로는 못 잡음 → 별도 핸들러에서 `CommonResponse` JSON 으로 응답
- 프론트: 401 → 재발급 시도 / 403 → "권한이 없습니다" 토스트

---

## 7. 서버 보안 설정 (1단계)

| 항목 | 내용 | 이유 |
| --- | --- | --- |
| CORS | 허용 origin 명시 (`app.cors.allowed-origins`). 로컬 `http://localhost:3000`, 운영 `https://academy-hk.com`, `https://www.academy-hk.com` | `*` + credentials 는 아무 사이트나 인증 요청 후 응답을 읽을 수 있음. 중복 `CorsFilter` 빈 제거, `http.cors()` 하나로 |
| Swagger | 운영(docker)에서 springdoc 비활성화 + 공개 경로도 같은 설정값에 연동 | `/v3/api-docs` 가 관리자 API 전체 설계도를 노출 |
| 없는 경로 | `NoResourceFoundException` → **404** | 기존엔 500 + ERROR 스택트레이스 |
| 로그 조회 API | `/v1/admin/logs` **삭제** | 미사용, ROLE_USER 도 접근 가능 + `lines` 무제한. 로그는 Grafana + Loki 로 조회 |
| 미사용 코드 | 프론트 signup 페이지·API, `toggleAccountState`, `ACCOUNT_PENDING` 삭제 | 공격 면적 축소 |

### 7-1. 로그인 실패 응답 통일
- 없는 아이디 / 비밀번호 틀림 → 둘 다 **401** `아이디 또는 비밀번호가 올바르지 않습니다.` (`LOGIN_FAILED`)
- 없는 아이디여도 **가짜 해시로 BCrypt 비교**를 한 번 수행 → 응답 시간으로 계정 존재 여부를 알 수 없음 (가짜 해시는 서버 시작 시 1회 생성)
- 서버 로그에는 원인(존재하지 않는 계정 / 비밀번호 불일치)을 구분해서 남김

---

## 8. 환경 · 프로필 설정

| 파일 | 커밋 | 내용 |
| --- | --- | --- |
| `application.properties` | O | 공통 + **로컬 기본값**: JWT 만료, `app.cors.allowed-origins=http://localhost:3000`, `app.auth.cookie-secure=false`, Swagger 켜짐(기본값) |
| `application-docker.properties` | O | **운영 덮어쓰기**: DB/JWT 비밀값은 환경변수, 운영 도메인 CORS, `cookie-secure=true`, springdoc 끔 |
| `application-dev.properties` | **X (gitignore)** | 로컬 전용 비밀값만: 로컬 DB 접속, `jwt.secret` |

- **운영**: `server/Dockerfile` 이 `-Dspring.profiles.active=docker` 로 고정 → 운영 컨테이너는 항상 운영 설정
- **로컬**: IntelliJ `AcademyApplication` 실행, Active profiles = `dev`, 환경변수 없음
- 동작 설정(CORS, Swagger, 쿠키)은 커밋되는 파일에만 둔다 — gitignore 파일에 두면 레포만 봐서는 알 수 없음
- 로컬 `docker-compose.dev.yml` 로 띄우면 docker 프로필 = 운영과 같은 조건 (localhost:3000 CORS 차단, Swagger 꺼짐)

---

## 9. 에러 응답 정리

| 코드 | HTTP | 메시지 | 발생 |
| --- | --- | --- | --- |
| `UNAUTHORIZED` | 401 | 인증이 필요합니다. | 보호된 API 에 유효한 access 없음 |
| `ACCESS_DENIED` | 403 | 접근 권한이 없습니다. | 권한 부족 |
| `LOGIN_FAILED` | 401 | 아이디 또는 비밀번호가 올바르지 않습니다. | 로그인 실패 |
| `INVALID_REFRESH_TOKEN` | 401 | 유효하지 않은 리프레시 토큰입니다. | 재발급 실패 (모든 사유) |
| `INVALID_ROLE` | 400 | 허용되지 않는 권한입니다. | 권한 변경 값 오류 |
| `LAST_ADMIN` | 409 | 마지막 관리자는 삭제하거나 일반 권한으로 변경할 수 없습니다. | 마지막 관리자 삭제·강등 |
| (없는 경로) | 404 | 요청한 리소스를 찾을 수 없습니다. | 존재하지 않는 URL |

모든 에러는 `{"success": false, "message": "...", "data": null}` 형식.

---

## 10. 알려진 한계 · 추후 검토

| 항목 | 설명 | 필요 시 대응 |
| --- | --- | --- |
| access 즉시 무효화 불가 | 로그아웃·비밀번호/권한 변경 후에도 이미 발급된 access 는 최대 30분 유효 (권한도 옛 값) | access 블랙리스트(Redis) 또는 요청마다 DB 권한 확인 |
| refresh 재사용 시 강제 로그아웃 없음 | 공격자가 훔친 refresh 를 **먼저** 쓰면 그 세션은 공격자 쪽으로 이어짐 (정상 사용자는 401 → 재로그인) | 비밀번호 변경으로 전체 세션 삭제. 필요하면 재사용 감지 시 세션 삭제 추가 |
| 관리자 동시 강등 경합 | 관리자 2명이 동시에 서로를 강등하면 둘 다 검사를 통과할 수 있음 | DB 잠금 (`SELECT ... FOR UPDATE`) |
| 본인 비밀번호 변경 시 현재 비밀번호 미확인 | 탈취된 access(30분)로 비밀번호를 바꿔 주인을 쫓아낼 수 있음 | 현재 비밀번호 확인 추가 |
| 세션 목록/원격 로그아웃 UI 없음 | 기기별 세션은 있지만 화면에서 볼 수 없음 | `refresh_token` 테이블 기반으로 "로그인된 기기" 화면 추가 가능 |

범위 밖으로 따로 진행 예정: nginx, actuator 노출, 모니터링

---

## 11. 운영 배포 체크리스트 (2단계 반영 시)

- [ ] 배포 **전**: `SELECT DISTINCT role FROM account;` → `ROLE_ADMIN` / `ROLE_USER` 외 값 없음 확인 (enum 전환)
- [ ] 서버 `.env` 에서 `JWT_ACCESS_EXPIRATION`, `JWT_REFRESH_EXPIRATION` 삭제 (더 이상 사용 안 함)
- [ ] 배포 (사용자 없는 새벽) → **기존 사용자 전원 1회 재로그인 필요** (기존 토큰에 `type`/`sid` 없음)
- [ ] `refresh_token` 테이블 자동 생성 확인
- [ ] 배포 **후**: `ALTER TABLE account DROP COLUMN refresh_token;` (옛 평문 refresh 컬럼 제거)
- [ ] `https://api.academy-hk.com/v3/api-docs` → 401
- [ ] 로그인 후 F12 쿠키에 `Secure` ✓ 확인

---

## 12. 확인 방법

### 브라우저 (F12)
| 탭 | 확인 |
| --- | --- |
| Application → Local Storage | `accessToken` 없음 |
| Application → Cookies → API 도메인 | `refreshToken`: HttpOnly ✓, Path `/v1/auth`, SameSite Strict, (운영) Secure ✓ |
| Console | `document.cookie` 에 refreshToken 안 보임 |
| Network (새로고침) | `reissue` 1건 → 이후 API 200 |
| Network (access 만료 후) | `401` → `reissue` 1건 → 원래 요청 `200` |
| Network (로그아웃) | `logout` 200, `Set-Cookie: refreshToken=; Max-Age=0` |

> access 만료를 빨리 보려면 로컬 서버를 `--jwt.access-expiration=20000` (20초) 인자로 실행

### curl
```bash
# 로그인 (쿠키를 jar 파일에 저장)
curl -c jar -X POST localhost:8888/v1/auth/login -H 'Content-Type: application/json' -d '{"userId":"아이디","password":"비번"}'
# 재발급 (jar 의 refreshToken 값이 바뀜)
curl -b jar -c jar -X POST localhost:8888/v1/auth/reissue
# 로그아웃 (jar 에서 refreshToken 삭제)
curl -i -b jar -c jar -X POST localhost:8888/v1/auth/logout
```

### DB
```bash
docker exec -it mysql mysql -uroot -proot Heungkuk \
  -e "select account_id, left(session_id,8) sid, left(token_hash,10) hash, expires_at, updated_at from refresh_token;"
```

---

## 13. 관련 파일

| 구분 | 파일 |
| --- | --- |
| 보안 설정 | `server/.../global/security/config/SecurityConfig.java` |
| 토큰 | `global/security/jwt/JwtProvider.java`, `JwtAuthenticationFilter.java`, `RefreshTokenCookieProvider.java`, `TokenHashUtil.java` |
| 401/403 | `global/security/handler/JwtAuthenticationEntryPoint.java`, `JwtAccessDeniedHandler.java` |
| 인증 API | `global/security/controller/AuthController.java`, `service/AuthService.java`, `dto/AuthTokens.java` |
| 세션 | `domain/account/entity/RefreshToken.java`, `repository/RefreshTokenRepository.java` |
| 권한 | `domain/account/entity/Role.java`, `service/AccountServiceImpl.java` |
| 에러 | `global/exception/ErrorCode.java`, `GlobalExceptionHandler.java` |
| 설정 | `server/src/main/resources/application.properties`, `application-docker.properties` |
| 프론트 | `client/store/auth.ts`, `client/lib/api/instance.ts`, `client/lib/utils/auth.ts`, `client/lib/utils/jwt.ts`, `client/app/(admin)/layout.tsx`, `client/components/layout/ProfileDropdown.tsx` |
