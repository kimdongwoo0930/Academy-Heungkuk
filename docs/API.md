# 📡 API 명세서

> Base URL: `https://api.academy-hk.com`
> 인증이 필요한 API는 Header에 `Authorization: Bearer {accessToken}` 필요
> 모든 응답 형식: `{ "success": true, "message": "...", "data": { ... } }`

---

### 인증 (공개)

| Method | Endpoint        | 설명                |
| ------ | --------------- | ------------------- |
| POST   | `/auth/login`   | 로그인 (JWT 발급)   |
| POST   | `/auth/reissue` | Access Token 재발급 |

### 계정 관리 `🔐 JWT 필요`

| Method | Endpoint                        | Auth       | 설명                 |
| ------ | ------------------------------- | ---------- | -------------------- |
| POST   | `/admin/accounts`               | ROLE_ADMIN | 계정 생성            |
| GET    | `/admin/accounts`               | 인증 필요  | 전체 계정 조회       |
| PATCH  | `/admin/accounts/{id}/role`     | ROLE_ADMIN | 역할 변경            |
| PATCH  | `/admin/accounts/{id}/password` | ROLE_ADMIN | 관리자 비밀번호 변경 |
| PATCH  | `/admin/accounts/me/password`   | 인증 필요  | 내 비밀번호 변경     |
| DELETE | `/admin/accounts/{id}`          | ROLE_ADMIN | 계정 삭제            |

### 예약 관리 `🔐 JWT 필요`

| Method | Endpoint                              | 설명                                             |
| ------ | ------------------------------------- | ------------------------------------------------ |
| POST   | `/admin/reservations`                 | 예약 등록 (강의실·객실·식사 포함)                |
| GET    | `/admin/reservations?year=`           | 연도별 전체 예약 조회                            |
| GET    | `/admin/reservations/range`           | 날짜 범위 예약 조회 (`?from=&to=`)               |
| GET    | `/admin/reservations/search`          | 예약 검색 (키워드·상태·날짜 범위·페이징)         |
| GET    | `/admin/reservations/{id}`            | 예약 상세 조회                                   |
| PUT    | `/admin/reservations/{id}`            | 예약 전체 수정 (하위 데이터 재생성)              |
| DELETE | `/admin/reservations/{id}`            | 예약 취소 (상태를 "취소"로 변경, Soft)           |
| DELETE | `/admin/reservations/{id}/hard`       | 예약 영구 삭제 (하위 데이터 포함)                |
| GET    | `/admin/reservations/check-classroom` | 강의실 이용 가능 여부 확인 (`?classroom=&date=`) |

### Excel `🔐 ROLE_ADMIN 필요`

| Method | Endpoint                                | 설명                       |
| ------ | --------------------------------------- | -------------------------- |
| GET    | `/admin/reservations/{id}/estimate`     | 견적서 Excel 다운로드      |
| GET    | `/admin/reservations/{id}/trade`        | 거래명세서 Excel 다운로드  |
| GET    | `/admin/reservations/{id}/confirmation` | 확인서 Excel 다운로드      |
| GET    | `/admin/reservations/export`            | 전체 예약 데이터 내보내기  |
| POST   | `/admin/reservations/import`            | 예약 데이터 Excel 가져오기 |

### 설문 (공개 / 관리자 혼합)

| Method | Endpoint                               | Auth | 설명                  |
| ------ | -------------------------------------- | ---- | --------------------- |
| POST   | `/admin/surveys/token/{reservationId}` | 🔐   | 설문 토큰(URL) 생성   |
| GET    | `/admin/surveys/token/{reservationId}` | 🔐   | 예약별 설문 토큰 조회 |
| GET    | `/admin/surveys/tokens`                | 🔐   | 전체 토큰 목록 조회   |
| GET    | `/admin/surveys/{reservationId}`       | 🔐   | 예약별 설문 응답 조회 |
| GET    | `/admin/surveys`                       | 🔐   | 전체 설문 응답 조회   |
| GET    | `/survey/check/{token}`                | 공개 | 토큰 유효성 확인      |
| POST   | `/survey/{token}`                      | 공개 | 설문 응답 제출        |

### 대시보드 `🔐 JWT 필요`

| Method | Endpoint           | 설명                                                              |
| ------ | ------------------ | ----------------------------------------------------------------- |
| GET    | `/admin/dashboard` | 대시보드 전체 데이터 (KPI·오늘 강의실·월별 추이·만족도·최근 설문) |

### 앱 설정 `🔐 JWT 필요`

| Method | Endpoint          | 설명                    |
| ------ | ----------------- | ----------------------- |
| GET    | `/admin/settings` | 설정 전체 조회 (KV Map) |
| PUT    | `/admin/settings` | 설정 전체 저장          |

### 모니터링 (내부 전용, 인증 불필요)

> Prometheus가 스크랩하는 엔드포인트 — 외부 직접 호출 불필요

| Method | Endpoint              | 설명                              |
| ------ | --------------------- | --------------------------------- |
| GET    | `/actuator/health`    | 애플리케이션 헬스 체크            |
| GET    | `/actuator/prometheus`| Prometheus 메트릭 스크랩 엔드포인트 |
