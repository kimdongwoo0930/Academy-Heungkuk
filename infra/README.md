# 🏗️ 인프라 (infra/)

> 운영 서버(Oracle Cloud, 춘천 리전)에서 쓰는 docker compose · nginx · 모니터링 설정을 모아둔 폴더입니다.
> 앱 코드와 Dockerfile 은 `server/`, `client/` 에 있습니다.

---

## 구조

```
infra/
├── compose.sh                    # docker compose 래퍼 — 두 compose 파일 + 루트 .env 를 항상 함께 지정
├── docker/
│   ├── compose.yml               # 앱: db, backend, client, nginx + 공용 네트워크·볼륨
│   └── compose.monitoring.yml    # 모니터링: prometheus, loki, promtail, grafana, node-exporter, cadvisor
├── nginx/
│   ├── conf.d/                   # nginx 가 파일 이름 순서대로 읽음 (번호 = 읽는 순서)
│   │   ├── 00-common.conf            # 로그 형식(JSON), access_log, server_tokens off
│   │   ├── 01-cloudflare-realip.conf # Cloudflare 대역 → 실제 접속자 IP 복원
│   │   ├── 10-default-reject.conf    # 등록 안 된 도메인·IP 직접 접속 거부
│   │   ├── 20-http-redirect.conf     # 80 → https
│   │   ├── 30-frontend.conf          # academy-hk.com, www — 보안 헤더, X-Powered-By 숨김
│   │   ├── 40-api.conf               # api — actuator 차단(health 만 공개), 업로드 10MB
│   │   └── 50-grafana.conf           # grafana — HSTS
│   ├── snippets/                 # 공통 조각 (conf.d 에서 include)
│   │   ├── ssl.conf                  # 인증서 경로 + TLS 버전·암호
│   │   ├── proxy.conf                # 공통 프록시 헤더 (Host, X-Real-IP, X-Forwarded-*)
│   │   ├── proxy-upgrade.conf        # WebSocket 업그레이드 헤더
│   │   ├── hsts.conf                 # HSTS
│   │   └── security-headers.conf     # 프론트 보안 헤더 (hsts + 4개)
│   └── ssl/                      # Cloudflare Origin 인증서 (gitignore — 서버에만 존재)
├── host/
│   └── journald/retention.conf   # 서버 OS 시스템 로그 보관 설정 (배포로 적용 안 됨 — 아래 "서버 OS 설정")
└── monitoring/
    ├── prometheus/prometheus.yml
    ├── loki/loki-config.yaml
    ├── promtail/promtail-config.yaml
    └── grafana/dashboards/hka-overview.json   # 대시보드 export (Import 용, 자동 적용 아님)
```

저장소 루트에 남는 것: `.env`(비밀값, gitignore), `logs/`(Spring 로그 — backend·promtail 이 마운트), `CHANGELOG.md`(프론트 변경 이력 화면이 읽음)

---

## 실행

항상 **래퍼 `infra/compose.sh`** 로 실행합니다 (어느 폴더에서 실행해도 됨).

```bash
infra/compose.sh ps
infra/compose.sh logs --tail=100 backend
infra/compose.sh up -d <서비스>
```

- 래퍼 = `docker compose -f infra/docker/compose.yml -f infra/docker/compose.monitoring.yml --env-file .env`
  두 파일이 합쳐져 하나의 프로젝트로 동작. **한 파일만 지정해서 실행하지 않기** — 다른 파일의 컨테이너를 "주인 없는 컨테이너"로 보고,
  `--remove-orphans` 를 붙이면 삭제될 수 있음
- compose 안의 상대 경로는 `infra/docker/` 기준, 공통 설정(restart, network)은 파일마다 `x-common` 앵커로 묶음
- 프로젝트 이름은 compose 파일에 `name: academy-heungkuk-v2-` 로 고정 — 폴더를 옮겨도 볼륨(`academy-heungkuk-v2-_mysql_data` 등)·네트워크 이름이 바뀌지 않게 하기 위함. **지우면 DB 가 빈 새 볼륨에 붙습니다.**

---

## 배포 (GitHub Actions — `.github/workflows/deploy.yml`)

`main` 에 push 되면:
1. backend / client 이미지를 ARM 러너에서 빌드 → GHCR 에 `:latest`, `:<커밋 SHA>` 로 push
2. 서버에 SSH 접속 → `git reset --hard origin/main`
3. nginx 설정 검사 (새 설정으로 일회용 컨테이너에서 `nginx -t`) — 실패하면 배포 중단
4. `up -d --no-deps backend client nginx` — 앱 교체, nginx 는 설정이 바뀐 경우에만 재생성, db·모니터링은 건드리지 않음
5. `nginx -s reload` — nginx 설정 변경 반영 (연결 끊김 없음)
6. 안 쓰는 이미지 정리 — 어떤 컨테이너도 쓰지 않고 만든 지 7일 지난 이미지 삭제 (`docker image prune -af --filter until=168h`)

db · 모니터링 서비스 설정을 바꿨다면 배포 후 서버에서 직접 `infra/compose.sh up -d <서비스>` 로 반영합니다.

---

## 네트워크 · 보안 구성

| 구간 | 설정 |
| --- | --- |
| DNS | `academy-hk.com`, `www`, `api`, `grafana` 모두 Cloudflare 프록시(주황 구름) |
| Cloudflare | SSL **Full (strict)**, **Always Use HTTPS** 켬, 국가 제한(대한민국) |
| Oracle 보안 목록 (Default Security List) | **80 / 443 은 Cloudflare IPv4 대역만 허용**, 22(SSH)는 전체 허용 (GitHub Actions 배포용) |
| 서버 방화벽(iptables) | Oracle 우분투 기본값 유지 |
| nginx | 등록 도메인 외 요청 거부(default_server), actuator 는 `/actuator/health` 만 공개, 보안 헤더, 업로드 10MB |
| 외부 공개 포트 | nginx 80 / 443 뿐 (spring 8888, grafana 3000, db 3306 은 내부 네트워크 전용) |

---

## 로그 보관 정책 (한 달)

| 로그 | 위치 | 보관 | 설정 |
| --- | --- | --- | --- |
| Spring 로그 파일 | `logs/*.log` (app, error, auth, reservation, access) | 30일 (app 은 최대 1GB) | `server/src/main/resources/logback-spring.xml` `maxHistory` |
| Loki (로그 검색) | `loki_data` 볼륨 | 30일 (compactor 가 삭제) | `monitoring/loki/loki-config.yaml` `retention_period: 720h` |
| 서버 시스템 로그 | `/var/log/journal` | 한 달, 최대 500MB | `host/journald/retention.conf` |
| nginx 접근 로그 | `nginx_logs` 볼륨 | nginx 컨테이너 시작 시 비워짐 (내용은 Loki 에 보관) | `docker/compose.yml` nginx `command` |
| Prometheus 메트릭 | `prometheus_data` 볼륨 | 15일 | `docker/compose.monitoring.yml` `--storage.tsdb.retention.time` |
| 컨테이너 로그 (`docker logs`) | `/var/lib/docker/containers` | 컨테이너당 최대 30MB (10MB × 3, 보통 한 달치 이상) | `docker/compose*.yml` `x-common.logging` — Docker 는 기간 기준 삭제를 지원하지 않아 크기로 제한 |

---

## 자주 하는 작업

### nginx 설정 변경
`infra/nginx/conf.d/`(서버 블록) 또는 `snippets/`(공통 조각) 수정 → main 배포 시 자동 검사·반영.
- 도메인 추가: `conf.d/` 에 번호를 붙인 파일 하나 추가 + `20-http-redirect.conf` 의 server_name 에 추가
- 주의: `location` 안에서 `add_header` 를 쓰면 server 단위 보안 헤더가 전부 무시됨 — 보안 헤더는 server 단위 include 로만
서버에서 바로 반영하려면: `docker exec hka-nginx nginx -t && docker exec hka-nginx nginx -s reload`

### Cloudflare IP 목록 갱신 (드묾 — Cloudflare 가 대역을 바꿀 때)
목록: https://www.cloudflare.com/ips/ — **두 곳을 같이** 바꿉니다.
1. `infra/nginx/conf.d/01-cloudflare-realip.conf` 의 `set_real_ip_from`
2. Oracle 보안 목록 수신 규칙 (80, 443) — Oracle Cloud Shell 에서 Cloudflare 목록을 받아 수신 규칙 전체를 한 번에 교체

### 외부 이미지 버전 올리기
`infra/docker/compose*.yml` 의 태그 변경 → 배포 후 서버에서 `infra/compose.sh pull <서비스> && infra/compose.sh up -d <서비스>`
(Grafana · Loki 는 메이저 버전에서 설정 형식이 바뀌는 경우가 많으니 릴리스 노트 확인)

### 앱 롤백
서버 `.env` 에 이전 커밋 SHA 태그 지정 후 재생성:
```bash
BACKEND_IMAGE=ghcr.io/kimdongwoo0930/heungkuk-backend:<SHA>
CLIENT_IMAGE=ghcr.io/kimdongwoo0930/heungkuk-client:<SHA>
infra/compose.sh up -d --no-deps backend client
```

### 서버 OS 설정 (배포로 적용되지 않음 — 새 서버에서 한 번)
```bash
# 시스템 로그 한 달 보관
sudo mkdir -p /etc/systemd/journald.conf.d
sudo install -m 644 infra/host/journald/retention.conf /etc/systemd/journald.conf.d/retention.conf
sudo systemctl restart systemd-journald
```

### 모니터링 설정 변경 (prometheus / loki / promtail)
설정 파일 수정 → main 배포 → 서버에서 해당 서비스 재생성 (배포 스크립트는 앱·nginx 만 교체):
`infra/compose.sh up -d --force-recreate <서비스>`

### 새 서버 구성 시 준비물 (git 에 없는 것)
- 저장소 루트 `.env` — DB · JWT_SECRET · Grafana 계정/SMTP 값
- `infra/nginx/ssl/origin.pem`, `origin.key` (Cloudflare → SSL/TLS → Origin Server 에서 발급, key 는 `chmod 600`)
- `logs/` 폴더
