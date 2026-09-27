# CHANGELOG

## [4.0.2] - 2026-09-27

### Changed

- **로그 보관 기간 한 달로 통일**
  - Spring 로그 파일 30일 (에러 로그 60일 → 30일), Loki 로그 검색 30일, 서버 시스템 로그 한 달(최대 500MB)
  - 컨테이너 로그(`docker logs`)는 컨테이너당 최대 30MB (10MB × 3) 로 제한
- **배포 시 안 쓰는 이미지 자동 정리** — 어떤 컨테이너도 쓰지 않고 7일 지난 이미지 삭제
- 버전 표기 통일 (`build.gradle`, `package.json` → 4.0.2)

---

## [4.0.1] - 2026-09-27

### Security

- **서버 직접 접속 차단** — Oracle 방화벽에서 80/443 을 Cloudflare 경유만 허용, nginx 에서 등록되지 않은 도메인·IP 직접 접속 거부
- **모니터링 정보 외부 차단** — `/actuator/prometheus` 등 비공개 (`/actuator/health` 만 공개)
- **보안 헤더 추가** — HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy / 서버 버전·기술 정보 숨김
- 접속 로그에 Cloudflare 서버 IP 대신 **실제 접속자 IP** 기록

### Changed

- **엑셀 가져오기 업로드 최대 10MB** (기존 1MB 초과 시 실패)
- 인프라 설정을 `infra/` 폴더로 정리 — docker compose(앱 / 모니터링), nginx(역할별 설정 + 공통 조각), 모니터링 설정 분리
- 외부 이미지(MySQL, nginx, Grafana, Loki, Prometheus 등) 버전 고정
- 배포 시 nginx 설정 자동 검사·반영, 앱만 교체 (DB·모니터링 재시작 없음)

---

## [4.0.0] - 2026-09-27

### Added

- **여러 기기 동시 로그인** — PC·태블릿 등 기기별 로그인 세션 관리
- **로그아웃 시 서버 세션 삭제** — 이 기기만 로그아웃, 다른 기기는 유지
- **계정 권한 보호** — 허용되지 않는 권한 값 거부, 마지막 관리자는 삭제·강등 불가

### Changed

- **로그인 유지 방식 변경** — 새로고침·새 탭에서도 로그인 유지, 30분마다 자동으로 토큰 재발급
  - access 토큰은 브라우저 메모리에만 보관 (localStorage 사용 안 함)
  - refresh 토큰은 HttpOnly 쿠키 (30일), 재발급할 때마다 교체
- **비밀번호·권한 변경 시 해당 계정의 모든 기기 로그아웃** (본인 비밀번호 변경 후 재로그인 안내)
- 로그인 실패 메시지 통일 — "아이디 또는 비밀번호가 올바르지 않습니다."
- 계정 권한 변경·삭제 실패 시 서버 메시지 그대로 표시

### Security

- 허용 도메인만 API 호출 가능 (CORS 제한), 운영 환경 Swagger 비공개
- refresh 토큰을 DB 에 원문 대신 해시로 저장, 토큰 종류(access / refresh) 구분
- 사용하지 않는 로그 조회 API 삭제

### Fixed

- 토큰 만료 시 로그인 화면으로 이동하지 않고 "권한이 없습니다"만 표시되던 문제 (미인증 401 / 권한 부족 403 구분)
- 존재하지 않는 주소 요청 시 500 오류 → 404

### Removed

- 사용하지 않는 회원가입 페이지·API

---

## [3.8.0] - 2026-04-30

### Added

- **강의실 사용불가 관리** (설정 페이지 → 강의실 관리 탭 신규)
  - 강의실 카드 클릭으로 사용불가 / 사용가능 토글
  - 저장 시 `PUT /v1/admin/settings/disabledClassroom` 호출, DB에 `disabledClassroom` 키로 저장
- **사용불가 강의실 전체 연동**
  - 대시보드 강의실 현황: 사용불가 강의실 회색으로 "사용불가" 표시
  - 일정현황: 사용불가 강의실 행 자동 숨김 (그룹 내 전체 비활성 시 그룹도 숨김)
  - 예약 모달: 강의실 선택 드롭다운에서 사용불가 강의실 제거 (전체 5개 페이지 공통 적용)
- **대시보드 fetch 로딩 오버레이**
  - KPI 카드·강의실 현황 클릭 시 데이터 로딩 중 반투명 오버레이 + 스피너 + "로딩 중..." 표시

### Changed

- `CLASSROOM_LIST` 공통 상수 추가 (`lib/constants/classrooms.ts`) — `RoomStatus`, 설정 페이지에서 공유

---

## [3.7.0] - 2026-04-29

### Added

- **설문 만족도 통계 차트** (`SurveyStatsChart`) 신규 추가
  - 직원서비스·청결·시설·식당·비용 5개 항목 도넛 차트
  - 항목별 평균 점수(색상 변화) + 점수별 건수 범례 표시
  - 설문 관리 페이지 목록 상단에 배치

### Changed

- **숙박현황·식수관리 통계 카드** 컴팩트 사이즈로 축소 (패딩·폰트·간격 감소)
- **숙박현황 '최대 이용일' 카드** 제거 → 2컬럼 레이아웃으로 변경
- **숙박현황·식수관리 하단 총합 행** 제거
- **일정현황 스케줄러** 그룹 행 배경색을 날짜 셀 전체에 적용 (기존: 첫 3열만)
- **일정현황 섹션 타이틀** 스타일 개선 — 악센트 바, 패딩, 라운드 모서리 클리핑

### Fixed

- **설문 관리 페이지 다크모드** 미적용 수정
  - 페이지 제목·검색창 (돋보기 아이콘 무한 반복 버그 포함)
  - 만족도 통계 카드·도넛 링 배경색
  - 설문 결과 카드 전체 (배경·텍스트·태그·배지·점수 그리드·의견 박스)

---

## [3.6.0] - 2026-04-29

### Added

- **대시보드 KPI 카드 클릭 인터랙션**
  - "이번 달 이용 업체" 클릭 → 당월 예약 목록 모달 표시
  - "오늘 일정" 클릭 → 오늘 입실 업체 목록 모달 표시
  - 목록 모달에서 항목 클릭 시 예약 편집 모달 연동
- **금일 사용 단체 클릭 → 예약 편집 모달** — 항목 클릭 시 해당 예약 수정 가능
- **오늘 강의실 현황 클릭 → 예약 편집 모달** — 사용 중인 강의실 클릭 시 수정 (관리자 전용)
- **`DashboardListModal` 컴포넌트** 신규 추가

### Changed

- **대시보드 "오늘 입실" → "오늘 일정"** 카드 레이블 변경
- **대시보드 "오늘 일정" → "금일 사용 단체"** 섹션 레이블 변경
- **금일 사용 단체 업체 그룹핑** — 같은 업체의 강의실을 `201 · 202호` 형태로 합쳐 표기
- **오늘 일정 KPI 수치** — `startDate = 오늘` 기준 → `todayClassrooms` 고유 업체 수 기준으로 변경
- **오늘 일정 KPI 인원** — `startDate = 오늘` 합산 → 금일 사용 단체 기준 합산으로 변경
- **`TodayClassroomItem`** 백엔드 DTO 및 프론트 타입에 `reservationId` 필드 추가

### Fixed (Excel)

- **확인서** 신청인·현장담당자 이름 뒤 "님" 자동 추가 (이미 "님"으로 끝나면 중복 방지), 폰트 1pt 축소로 잘림 방지
- **견적서** 시작일·종료일 요일 포함 형식으로 통일 (`yyyy년 MM월 dd일 (요일)`)
- **거래명세서** 발행일·시작일·종료일 요일 포함 형식으로 통일

---

## [3.5.0] - 2026-04-26

### Added

- **대시보드 API** (`GET /v1/admin/dashboard`)
  - KPI: 이번 달 이용 업체 수·전월 대비·오늘 입실 건수·인원·설문 평균 점수
  - 오늘 강의실 일정: 단체·강의실·목적·인원
  - 월별 이용 업체 추이: `COUNT(DISTINCT organization)` 기준 (중복 업체 제외)
  - 만족도 현황: 5개 항목 AVG 집계
  - 최근 설문 5건 테이블
- **대시보드 프론트 API 연동** — mock 데이터 → 실 API 교체

### Changed

- **설문 스키마 정규화** — `answer TEXT` JSON 단일 컬럼 → 21개 개별 타입 컬럼으로 분리
  - AVG 집계, 항목별 코멘트 저장 가능
  - 기존 데이터 JSON 파싱 마이그레이션 SQL 제공
- **설문 점수 체계 통일** — 1=매우만족(기존) → 5=매우만족으로 방향 반전
  - 만족도 바 차트 정방향 표시 (높을수록 좋음)
- **설문 관리 페이지** — mock 데이터 → `GET /v1/admin/surveys` 실 API 연동
- **설문 카드 UI 개선**
  - 헤더: 5개 항목 점수 배지 + 평균 점수 상시 표시 (접힌 상태에서도 확인 가능)
  - 본문: 지역·목적·업태·이용계기 태그 4개, 항목별 컬러 구분, 불만족 코멘트 표시
- **docker-compose.dev.yml** — Grafana / Loki / Promtail 제거 (운영 전용으로 분리)
- **다크 모드 토글** 헤더에 복원

### Fixed

- `SurveyCard.tsx` JSX 내 쌍따옴표 이스케이프 누락 → ESLint 빌드 오류 수정

---

## [3.4.0] - 2026-04-12

### Refactor

- **프론트엔드 모듈화 전면 리팩토링**
  - `hooks/useReservationSearch.ts` 추출 — 예약 목록·문서 페이지 공통 검색 훅으로 분리
  - `lib/constants/survey.ts` 신규 — `SATISFACTION_LABELS`, `SATISFACTION_ITEMS`, `REVISIT_LABELS` 상수 통합
  - `lib/constants/status.ts` 신규 — `STATUS_COLOR` 통합 (확정/예약/문의/취소 4개 상태 일관 적용)
  - `lib/constants/rooms.ts` 보완 — `ROOM_TYPES`, `ROOM_TYPE_LABEL` 추가
  - `lib/utils/quoteHelpers.ts` 신규 — 견적·거래명세서·확인서에서 중복 사용하던 금액 계산·날짜 포맷 함수 추출
  - `lib/utils/surveyHelpers.ts` 신규 — `parseAnswers` 추출 (SurveyModal, 설문결과 페이지 공통)
  - `types/account.ts` 신규 — `AccountInfo`, `CreateAccountRequest` 타입 `lib/api/` 에서 분리
  - `types/reservation.ts` 보완 — `PageResult<T>`, `ImportResult`, `ReservationRequestBody` 추가
  - `lib/api/reservation.ts` 내부 `downloadBlob` 헬퍼 도입 — 동일한 Blob 다운로드 패턴 3개 제거
- **폰트 self-hosting 전환**
  - Pretendard CDN(`cdn.jsdelivr.net`) → `next/font/local` + `public/fonts/` woff2 서브셋으로 교체
  - 외부 네트워크 의존 제거, 초기 로딩 안정성 개선
- **캘린더 렌더링 최적화**
  - `accommodation/page.tsx`, `scheduler/page.tsx` 달력 날짜 배열·공휴일 셋·예약 필터 결과를 `useMemo`로 메모이제이션
  - `getRoomsOnDate`: 기존 `Array.find` O(n) → `Map` 기반 O(1) 룩업으로 교체
  - `isRedDay`: 매 셀 호출마다 `checkIsHoliday` 실행 → `redDaySet.has()` O(1) 단축

---

## [3.3.0] - 2026-04-11

### Added

- **다크 모드 전체 지원** (Beta)
  - CSS 변수 토큰 시스템 기반 — `[data-theme='dark']` 속성으로 전환
  - 전체 admin 페이지 적용: 예약, 일정현황, 식수현황, 숙박현황, 문서관리, 설문결과, 설정
  - 일정현황(Scheduler): 블루-네이비 팔레트 — 컬러 바와의 대비를 고려한 별도 디자인
  - 나머지 admin 페이지: 뉴트럴 그레이 팔레트 (Zinc 계열)
  - 사이드바: 딥 퍼플 그라디언트 (`#1e1b2e` → `#17152a`)
  - ThemeToggle 헤더 배치 + **Beta** 배지 표시
- **호실 선택 모달 다크 모드** 수정
  - 파스텔 배경(인라인 고정) + 흰 글씨 겹침으로 호실 번호 안 보이던 문제 수정

### Style

- 일정현황 그룹 행 배경 제거 → 강의실 유형 셀 좌측 컬러 보더로 통일 (다크 모드)
- 예약 바 채도·밝기 필터 적용으로 형광 방지 (`saturate(0.75) brightness(0.88)`)

---

## [3.2.0] - 2026-04-11

### Added

- **Grafana 통합 대시보드** (`grafana/dashboards/hka-overview.json`)
  - Spring Boot: Uptime / Heap Used / CPU Usage / HTTP req/s / JVM Heap 추이 / 상태코드별 요청
  - 서버 리소스: CPU 사용률 / 메모리 사용량 / 디스크 사용률 / 네트워크 수신·송신
  - Docker 컨테이너: 컨테이너별 CPU / 메모리 (cAdvisor)
  - 로그: ERROR 발생률 / NGINX 5xx 발생률 / Spring 전체·에러·인증·예약 로그 / NGINX Access 로그
  - Grafana Import에서 바로 사용 가능 (`__inputs` 기반 데이터소스 매핑)
- **NGINX 로그 라벨 체계 정리**
  - `log_type: nginx-access` / `log_type: nginx-error` 로 분리
  - Spring `log_type: error` 와 충돌 방지
- `logs/.gitkeep` 추가 — 배포 시 `logs/` 폴더 존재 보장
  - `.gitignore`: `logs/` → `logs/*` + `!logs/.gitkeep` 로 변경

### Fixed

- **NGINX Promtail 수집 불가 문제** 수정
  - 원인: 공식 nginx 이미지가 로그 파일을 `/dev/stdout` pipe 심볼릭 링크로 생성
  - 해결: `docker-compose.yml` nginx `command`에서 시작 전 심볼릭 링크 제거 후 실제 파일 생성

---

## [3.1.0] - 2026-04-11

### Added

- **Prometheus + 메트릭 모니터링** 구축
  - `node-exporter`: 호스트 CPU / 메모리 / 디스크 수집
  - `cadvisor`: 컨테이너별 자원 사용량 수집
  - `prometheus`: 메트릭 수집 및 15일 보존 (`prometheus.yml`)
  - Spring `Actuator` + `Micrometer` 연동 → `/actuator/prometheus` 엔드포인트
  - SecurityConfig에 `/actuator/health`, `/actuator/prometheus` `permitAll` 추가
- **NGINX 로그 Promtail 수집** 추가
  - `nginx_logs` named volume으로 nginx ↔ promtail 파일 공유
  - `nginx-access` job: JSON 파싱 후 `method`, `status` 라벨 자동 추출
  - `nginx-error` job: 에러 로그 수집
- Grafana `depends_on`에 `prometheus` 추가
- `docs/Grafana-Loki.md` 전체 개편 (로그 + 메트릭 통합 문서)

### Removed

- **로그 뷰어 SSE 실시간 스트림 제거** (Grafana + Loki로 대체)
  - `LogService`: `subscribe()`, `startWatching()`, `broadcast()` 등 SSE 관련 메서드 비활성화
  - `LogController`: `/admin/logs/stream` 엔드포인트 비활성화
  - `JwtAuthenticationFilter`: 쿼리 파라미터 `?token=` 처리 비활성화
  - Next.js `app/api/logs/` 디렉토리 삭제 (`route.ts`, `stream/route.ts`)
  - 설정 페이지 로그 뷰어 탭 및 SSE state / useEffect 제거

---

## [3.x.x] - 2026-04

### Fixed

- 박스 해제시 데이터 삭제 문제 해결
- 예약 날짜 변경시 강의실 중복오류 버그
- SSE 구독자 누적 문제 해결 (AbortController + onerror 시 es.close())
- SSE async dispatch 시 `AuthorizationDeniedException` 수정 (`RequestAttributeSecurityContextRepository` 적용)
- `AsyncRequestNotUsableException` 불필요 에러 로그 억제 (DEBUG 레벨로 처리)
- Docker 로그 한글 깨짐 수정 (`-Dfile.encoding=UTF-8 -Dstdout.encoding=UTF-8`)
- 로그 뷰어 초기 로드 한글 깨짐 수정 (UTF-8 바이트 배열 디코딩)
- 로그 실시간 업데이트 안 되던 문제 수정 (WatchService → 500ms 폴링 교체)
- NGINX SSE 버퍼링으로 실시간 전송 안 되던 문제 수정 (`X-Accel-Buffering: no` 헤더 추가)
- 예약 서비스 빌드 오류 수정 (`getGroupName()` → `getOrganization()`)

### Added

- 정산자 동일 버튼 추가
- 확인서 생성
- UX 개선 (토스트 알림, isDirty 저장버튼, 커스텀 확인 다이얼로그)
- N+1 쿼리 개선 (findByReservationIn 적용)
- 예약 삭제 버튼 커스텀 다이얼로그 적용
- 설정 페이지 업데이트 내역 탭 추가
- **로그 뷰어** 추가 (설정 → 로그 탭)
  - app·auth·reservation·access·error 파일별 탭 전환
  - 초기 최근 1000줄 로드
  - SSE 실시간 스트림 (500ms 폴링, 브라우저 → Spring 직접 연결)
  - 키워드 검색, ERROR/WARN/DEBUG 색상 구분
  - 연결 상태 표시 (연결 중 / 실시간)
- 예약 데이터 xlsx 가져오기 (import) 기능 추가
- docker-compose logs 볼륨 마운트 (`./logs:/app/logs`)

### Style

- 예약 모달 스타일 변경
- 예약 마우스 호버시 강의실 확인가능

---

## [2.x.x] - 2026-03

### Added

- 주차별 인쇄 (월요일 시작, 2주씩 A3 한 장, 숙박 빨간 테두리)
- 일정 현황 화면 colspan 스패닝 바
- 숙박·식수 A3 인쇄
- 거래명세서·견적서 다운로드
- 백업 및 복구 기능
- 예약 정렬 토글
- 숙박 현황 날짜 클릭 시 호실 도면 조회
- 특식 구분 및 업체/현장 담당자 정보 필드 추가
- 비밀번호 변경

### Fixed

- 숙소 배정표 날짜 범위 퇴실일(+1일) 반영
- 잔금 미표시 오류
- 연락처 하드코딩 기본값 제거
- 글씨체 프리텐다드로 변경

### Refactor

- Service 인터페이스·Impl 분리
- 일정현황 3개월 범위 조회 최적화

---

## [1.x.x] - 2026-01 ~ 02

### Added

- 설문조사 3단계 멀티스텝 개편 및 결과 UI 개선
- 설문 토큰 만료 처리
- 예약 모달 UX 개선 및 숙박 더블클릭 예약 생성
- 숙박 현황 타입별 서브컬럼 분리
- 일정현황 인쇄, 숙소표 출력

---

## [0.x.x] - 초기 구축

### Added

- 공통 구조, 인증(Auth/Account) 도메인 구현
- Docker Compose, NGINX, Cloudflare SSL 설정
- Swagger 적용 및 백엔드 구조 정리
- 예약 도메인 프론트·백엔드 기본 구현
