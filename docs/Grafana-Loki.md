# 모니터링 시스템 — Grafana + Loki + Prometheus

## 전체 구조

```
┌─────────────────────────────────────────────────────────┐
│                     로그 파이프라인                       │
│  Spring 로그파일 ──┐                                     │
│  NGINX 로그파일  ──┤──→ Promtail ──→ Loki ──→ Grafana   │
└───────────────────┴─────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│                     메트릭 파이프라인                     │
│  Spring Actuator ──┐                                     │
│  node-exporter   ──┤──→ Prometheus ──→ Grafana          │
│  cAdvisor        ──┘                                     │
└──────────────────────────────────────────────────────────┘
```

---

## Docker Compose 서비스 구성

| 컨테이너명          | 이미지                          | 역할                         |
| ------------------- | ------------------------------- | ---------------------------- |
| `hka-loki`          | grafana/loki:3.7.1              | 로그 저장소                  |
| `hka-promtail`      | grafana/promtail:3.6.8          | 로그 파일 수집 에이전트      |
| `hka-prometheus`    | prom/prometheus:v3.11.1         | 메트릭 수집 및 저장          |
| `hka-node-exporter` | prom/node-exporter:v1.11.1      | 호스트 CPU / 메모리 / 디스크 |
| `hka-cadvisor`      | gcr.io/cadvisor/cadvisor:v0.55.1 | 컨테이너별 자원 사용량       |
| `hka-grafana`       | grafana/grafana:12.4.2          | 대시보드 및 알림             |

- 모든 모니터링 서비스는 `hka-network` 내부 통신 (외부 포트 미노출)
- Grafana만 NGINX를 통해 `https://grafana.academy-hk.com` 접근
- SMTP 설정은 `.env`에서 관리
- compose 파일: `infra/docker/docker-compose.yml`, 이미지 버전은 운영 버전으로 고정 (올릴 때는 태그 변경 후 해당 서비스만 pull/up)

---

## 설정 파일

### loki-config.yaml (`infra/monitoring/loki/`)

```yaml
auth_enabled: false  # Loki 자체 인증 비활성화 — 외부 포트 미노출이므로 안전

schema_config:
  configs:
    - from: 2024-01-01
      store: tsdb    # 인덱스 방식
      schema: v13    # 최신 스키마
      index:
        period: 24h  # 24h 롤링 인덱스

limits_config:
  reject_old_samples_max_age: 168h  # 7일 이상 된 로그 거부
```

- 스토리지: filesystem → `loki_data` Docker 볼륨

---

### promtail-config.yaml (`infra/monitoring/promtail/`)

**Spring 로그 수집** (`./logs` → `/var/log/spring`):

| job                | 파일            | `log_type` 라벨 |
| ------------------ | --------------- | --------------- |
| spring-app         | app.log         | app             |
| spring-error       | error.log       | error           |
| spring-access      | access.log      | access          |
| spring-auth        | auth.log        | auth            |
| spring-reservation | reservation.log | reservation     |

**NGINX 로그 수집** (`nginx_logs` 볼륨 → `/var/log/nginx`):

| job          | 파일       | `log_type` 라벨 | 비고                            |
| ------------ | ---------- | --------------- | ------------------------------- |
| nginx-access | access.log | nginx-access    | JSON 파싱 → method/status 라벨  |
| nginx-error  | error.log  | nginx-error     | 원문 텍스트                     |

> Spring `log_type=error` 와 충돌하지 않도록 NGINX는 `nginx-access` / `nginx-error` 로 분리

NGINX access 로그는 `default.conf`에서 JSON 형식으로 출력:
```nginx
log_format json_combined escape=json
  '{"time":"$time_iso8601","method":"$request_method",'
  '"uri":"$request_uri","status":"$status",'
  '"ip":"$remote_addr","response_time":"$request_time"}';
```

Promtail pipeline_stages로 JSON 파싱 후 `method`, `status`를 라벨로 추출 → Grafana 필터 가능

---

### prometheus.yml (`infra/monitoring/prometheus/`)

```yaml
scrape_configs:
  - job_name: spring-backend   # Spring Actuator /actuator/prometheus (포트 8888)
  - job_name: node-exporter    # 호스트 시스템 메트릭 (포트 9100)
  - job_name: cadvisor         # 컨테이너별 메트릭 (포트 8080)
  - job_name: prometheus       # Prometheus 자기 자신 (포트 9090)
```

- 스크랩 주기: 15초
- 데이터 보존: 15일 (`--storage.tsdb.retention.time=15d`)

---

## Spring Actuator 연동

### build.gradle

```groovy
implementation 'org.springframework.boot:spring-boot-starter-actuator'
implementation 'io.micrometer:micrometer-registry-prometheus'
```

### application.properties

```properties
management.endpoints.web.exposure.include=health,info,prometheus
management.endpoint.prometheus.enabled=true
management.endpoint.health.show-details=never
```

### SecurityConfig.java

`/actuator/health`, `/actuator/prometheus` → `permitAll` 처리 (Prometheus 인증 없이 스크랩):

```java
.requestMatchers("/v1/auth/**", "/v1/survey/**",
        "/actuator/health", "/actuator/prometheus")
.permitAll()
```

### logback-spring.xml 파일 분리

| appender         | 파일            | 라우팅                      |
| ---------------- | --------------- | --------------------------- |
| FILE             | app.log         | 전체                        |
| ERROR_FILE       | error.log       | ERROR 레벨만                |
| AUTH_FILE        | auth.log        | `global.security` 패키지    |
| RESERVATION_FILE | reservation.log | `domain.reservation` 패키지 |
| ACCESS_FILE      | access.log      | 각 도메인 Controller        |

---

## 볼륨 구성

```yaml
volumes:
  loki_data:       # Loki 로그 청크 저장
  grafana_data:    # Grafana 대시보드·설정 영속화
  prometheus_data: # Prometheus TSDB 저장
  nginx_logs:      # hka-nginx ↔ hka-promtail 로그 공유 (named volume)
```

`nginx_logs` named volume — nginx가 쓰고 promtail이 읽는 구조:

```yaml
nginx:
  volumes:
    - nginx_logs:/var/log/nginx   # 쓰기

promtail:
  volumes:
    - nginx_logs:/var/log/nginx   # 읽기
```

> **주의 — NGINX 심볼릭 링크 문제**
> 공식 nginx 이미지는 시작 시 `/var/log/nginx/access.log` → `/dev/stdout` (pipe) 심볼릭 링크를 생성한다.
> Promtail은 pipe를 읽지 못하므로 `command`로 시작 전 심볼릭 링크를 제거하고 실제 파일로 교체한다:
>
> ```yaml
> nginx:
>   command: >
>     /bin/sh -c "
>       rm -f /var/log/nginx/access.log /var/log/nginx/error.log &&
>       touch /var/log/nginx/access.log /var/log/nginx/error.log &&
>       nginx -g 'daemon off;'
>     "
> ```

---

## Grafana 접속 및 데이터소스 설정

- 운영: `https://grafana.academy-hk.com` (NGINX 프록시)
- 계정 정보는 `.env` 참고 (`GRAFANA_ADMIN_USER`, `GRAFANA_PASSWORD`)

### Loki 연결

1. Connections → Data sources → Add → **Loki**
2. URL: `http://hka-loki:3100`
3. Save & Test

### Prometheus 연결

1. Connections → Data sources → Add → **Prometheus**
2. URL: `http://hka-prometheus:9090`
3. Save & Test

---

## 통합 대시보드

파일: `infra/monitoring/grafana/dashboards/hka-overview.json`

Import 방법:
1. Grafana → **Dashboards → Import → Upload JSON file**
2. `hka-overview.json` 선택
3. Prometheus 데이터소스 → `hka-prometheus` 선택
4. Loki 데이터소스 → `hka-loki` 선택
5. Import

### 패널 구성

**Row 1 — Spring Boot** (Prometheus)

| 패널 | 타입 | 메트릭 |
| ---- | ---- | ------ |
| Uptime | stat | `process_uptime_seconds` |
| Heap Used | stat | `jvm_memory_used_bytes{area="heap"}` |
| CPU Usage | gauge | `process_cpu_usage` |
| HTTP req/s | stat | `http_server_requests_seconds_count` |
| JVM Heap 추이 | timeseries | Used / Committed / Max |
| HTTP 상태코드별 | timeseries | 2xx / 4xx / 5xx 분리 |

**Row 2 — 서버 리소스** (node-exporter)

| 패널 | 타입 | 메트릭 |
| ---- | ---- | ------ |
| CPU 사용률 | timeseries | `node_cpu_seconds_total{mode="idle"}` |
| 메모리 사용량 | timeseries | Used / Available / Total |
| 디스크 사용률 | gauge | `node_filesystem_avail_bytes` |
| 네트워크 수신/송신 | stat | `node_network_*_bytes_total` |

**Row 3 — Docker 컨테이너** (cAdvisor)

| 패널 | 타입 | 메트릭 |
| ---- | ---- | ------ |
| 컨테이너별 CPU | timeseries | `container_cpu_usage_seconds_total` |
| 컨테이너별 메모리 | timeseries | `container_memory_rss` |

**Row 4 — 로그** (Loki)

| 패널 | 타입 | 쿼리 |
| ---- | ---- | ---- |
| ERROR 발생률 | timeseries | `count_over_time({job="hka-backend", log_type="error"}[5m])` |
| NGINX 5xx 발생률 | timeseries | `count_over_time({job="hka-nginx", log_type="nginx-access", status=~"5.."}[5m])` |
| Spring 실시간 로그 | logs | `{job="hka-backend"}` |
| Spring 에러 로그 | logs | `{job="hka-backend", log_type="error"}` |
| NGINX Access 로그 | logs | `{job="hka-nginx", log_type="nginx-access"}` |
| 인증 로그 | logs | `{job="hka-backend", log_type="auth"}` |
| 예약 로그 | logs | `{job="hka-backend", log_type="reservation"}` |

---

## Loki 쿼리 예시

```logql
# Spring
{job="hka-backend"}                              # 전체 로그
{job="hka-backend", log_type="error"}            # 에러 로그
{job="hka-backend", log_type="auth"}             # 인증 로그
{job="hka-backend", log_type="reservation"}      # 예약 로그

# NGINX
{job="hka-nginx", log_type="nginx-access"}       # 전체 접근 로그
{job="hka-nginx", log_type="nginx-access", status="500"}  # 500 에러만
{job="hka-nginx", log_type="nginx-error"}        # NGINX 에러 로그

# 발생률
rate({job="hka-backend", log_type="error"}[5m])  # 5분간 에러 발생률
```

---

## 추천 외부 대시보드 (Import ID)

| 대시보드           | ID    | 데이터소스 |
| ------------------ | ----- | ---------- |
| Node Exporter Full | 1860  | Prometheus |
| cAdvisor           | 14282 | Prometheus |
| Spring Boot        | 19004 | Prometheus |

---

## 알림 설정

- Alert rule: ERROR 로그 발생 알림
- 조건: `rate({job="hka-backend", log_type="error"}[5m]) > 0`
- 평가 주기: 5분
- 알림 채널: 이메일 (SMTP Gmail 앱 비밀번호)

---

## .env 필요 항목

```env
GRAFANA_ADMIN_USER=
GRAFANA_PASSWORD=
GRAFANA_SMTP_USER=
GRAFANA_SMTP_PASSWORD=
```

---

## 향후 작업

- [ ] Prometheus Alert rule 추가 (CPU > 80%, 메모리 > 90%)
- [ ] NGINX 로그 Geo IP 파싱
- [ ] 대시보드 패널 추가 (응답 시간 p95/p99)
