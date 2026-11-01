# 📜 로그 시스템

---

## 전체 흐름

```
Spring (logback)  ──▶  logs/*.log  ──▶  Alloy  ──▶  Loki  ◀──  InfraDesk
  앱 코드의 log.info         호스트 파일      파일을 tail      저장·검색      SSH 터널로 조회
```

- 로그 **원본은 항상 `logs/*.log` 파일**입니다. Loki 는 검색용 사본이라서 Loki 데이터가 사라져도 파일에서 다시 수집할 수 있습니다.
- 앱 컨테이너(`/app/logs`)와 Alloy 컨테이너(`/var/log/app`, 읽기 전용)가 호스트의 같은 `logs/` 폴더를 공유합니다.

---

## 1. Spring (logback)

설정: `server/src/main/resources/logback-spring.xml`

### 로그 주제 (topic)

서비스 클래스에 `@Slf4j(topic = LogNames.XXX)` 를 붙이면 그 클래스의 로그가 주제별 파일로 따로 쌓입니다.
주제 이름은 `server/.../global/entity/LogNames.java` 에 상수로 정의합니다.

| 주제 | 파일 | 사용하는 클래스 | 남기는 내용 |
| --- | --- | --- | --- |
| `AUTH` | `auth.log` | `AuthService`, `AccountServiceImpl` | 로그인 성공·실패, 로그아웃, 재발급 거부, 계정 생성·삭제, 권한·비밀번호 변경 |
| `RESERVATION` | `reservation.log` | `ReservationServiceImpl`, `ExcelServiceImpl` | 예약 생성·수정·취소·영구 삭제, 견적서·거래명세서·확인서 생성, 엑셀 가져오기·내보내기 |
| `SURVEY` | `survey.log` | `SurveyServiceImpl` | 설문 토큰 생성, 설문 응답 제출 |
| `SETTING` | `setting.log` | `AppSettingServiceImpl` | 설정 변경(변경 전→후 값), 강의실·숙소 비활성화 |

주제를 지정하지 않은 로그(`GlobalExceptionHandler` 등)는 클래스 이름으로 기록되어 `app.log` / `error.log` 에만 남습니다.

### 파일과 보관

| 파일 | 내용 | 롤링 | 보관 |
| --- | --- | --- | --- |
| `app.log` | 전체 로그 | 하루 단위 + 100MB 초과 시 분할, `app.yyyy-MM-dd.N.log.gz` | 60일, 전체 최대 1GB |
| `error.log` | ERROR 만 | 하루 단위 + 50MB 초과 시 분할 | 60일 |
| `auth.log` `reservation.log` `survey.log` `setting.log` | 주제별 로그 | 하루 단위, `*.yyyy-MM-dd.log.gz` | 60일 |

- **`app.log` 에 함께 쌓이는 주제:** `AUTH` · `RESERVATION` · `SURVEY` 는 `additivity="true"` 라서 주제 파일과 `app.log` 양쪽에 남습니다.
- **`SETTING` 은 `additivity="false"`** 라서 `setting.log` 에만 남고 `app.log` 와 콘솔에는 나오지 않습니다.

### 프로파일별 설정

| 프로파일 | 로그 위치 | 출력 | 비고 |
| --- | --- | --- | --- |
| `local`, `dev` | `./logs` | 콘솔 + 파일 | 앱 패키지(`com.heungkuk.academy`)는 DEBUG |
| `prod`, `docker` | `/app/logs` | 콘솔 + 파일 | 전체 INFO |

### 로그 형식

```
2026-10-28 19:29:23.400 INFO  [http-nio-8888-exec-5] RESERVATION - 예약 생성: code=HK-20260401-002, organization=흥국생명 연수팀, ... 생성자=Admin
└ 시각(KST, ms)         └레벨 └스레드                └로거(주제명 또는 클래스)  └메시지
```

- 패턴: `%d{yyyy-MM-dd HH:mm:ss.SSS} %-5level [%thread] %logger{40} - %msg%n`
- 모든 로그 줄은 **날짜로 시작**합니다. Alloy 가 이 규칙으로 여러 줄을 한 건으로 묶으므로 패턴을 바꾸면 `config.alloy` 의 `firstline` 도 같이 바꿔야 합니다.

### 로그를 추가할 때

- 변경(생성·수정·삭제)과 인증 이벤트에 남기고, **누가 했는지**를 함께 기록합니다 (`생성자=`, `수정자=`, `요청자=`).
- 대상은 PK 가 아니라 사람이 알아볼 값(예약번호, 업체명, userId)으로 남깁니다.
- **비밀번호, 토큰 원문, 전화번호 같은 개인정보는 남기지 않습니다.**
- 예외는 `GlobalExceptionHandler` 가 남기므로, 서비스에서는 의미 있는 실패(권한 없음, 중복 시도 등)만 `warn` 으로 남깁니다.
- 로그는 컨트롤러가 아니라 서비스 계층에서 남기고, 단순 조회는 남기지 않는 것이 기본입니다 (민감한 조회만 예외).

---

## 2. Alloy (수집)

설정: `infra/alloy/config.alloy`

- 6개 파일(`app`, `error`, `auth`, `reservation`, `survey`, `setting`)을 tail 합니다.
- 각 줄에 라벨을 붙입니다: `job="spring"`, `type="<파일 이름>"`, `filename`.
- `stage.multiline` 으로 날짜로 시작하지 않는 줄(스택트레이스)을 앞 줄에 붙여 한 건으로 만듭니다.
- 어디까지 읽었는지는 `alloy-data` 볼륨에 저장하므로, 재시작해도 이미 보낸 로그는 다시 보내지 않습니다.

## 3. Loki (저장·검색)

설정: `infra/loki/loki-config.yaml`

- 단일 노드, 파일시스템 저장(`loki-data` 볼륨), 인증 없음(`auth_enabled: false`).
- **보관 60일** (`retention_period: 1440h`) — 파일 로그와 같은 기간. 지난 데이터는 compactor 가 삭제합니다.
- 포트는 호스트의 **`127.0.0.1:3100` 에만** 열려 있습니다. 서버 밖에서는 접근할 수 없습니다.
  로그에 사용자 ID·업체명이 들어 있고 Loki 에는 인증이 없으므로 **`0.0.0.0` 으로 열지 않습니다.**

---

## 4. 조회 (인프라데스크)

SSH 터널로 서버의 Loki 에 접속합니다.

인프라데스크의 Loki 주소를 `http://localhost:3100` 으로 지정합니다. 연결 확인: `curl http://localhost:3100/ready` → `ready`

### 라벨

| 라벨 | 값 |
| --- | --- |
| `job` | `spring` |
| `type` | `app` `error` `auth` `reservation` `survey` `setting` |

### 쿼리 예시 (LogQL)

```logql
{job="spring", type="reservation"}                          # 예약 로그 전체
{job="spring", type="auth"} |= "로그인 실패"                 # 로그인 실패만
{job="spring", type="error"}                                # 에러 (스택트레이스 포함)
{job="spring", type="reservation"} |= "영구 삭제" |= "admin"  # 키워드 AND 검색
```

> **`type` 을 꼭 지정하세요.** `AUTH` · `RESERVATION` · `SURVEY` 로그는 `app.log` 에도 남아서, `type="app"` 과 주제 스트림 양쪽에 같은 줄이 있습니다.
> 지정하지 않으면 같은 줄이 두 번 나옵니다.
