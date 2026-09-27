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
│   ├── conf.d/
│   │   ├── default.conf          # 도메인별 서버 블록, 보안 헤더, actuator 차단, 업로드 크기
│   │   └── cloudflare-realip.conf # Cloudflare 대역 → 실제 접속자 IP 복원
│   └── ssl/                      # Cloudflare Origin 인증서 (gitignore — 서버에만 존재)
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

## 자주 하는 작업

### nginx 설정 변경
`infra/nginx/conf.d/` 수정 → main 배포 시 자동 검사·반영.
서버에서 바로 반영하려면: `docker exec hka-nginx nginx -t && docker exec hka-nginx nginx -s reload`

### Cloudflare IP 목록 갱신 (드묾 — Cloudflare 가 대역을 바꿀 때)
목록: https://www.cloudflare.com/ips/ — **두 곳을 같이** 바꿉니다.
1. `infra/nginx/conf.d/cloudflare-realip.conf` 의 `set_real_ip_from`
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

### 새 서버 구성 시 준비물 (git 에 없는 것)
- 저장소 루트 `.env` — DB · JWT_SECRET · Grafana 계정/SMTP 값
- `infra/nginx/ssl/origin.pem`, `origin.key` (Cloudflare → SSL/TLS → Origin Server 에서 발급, key 는 `chmod 600`)
- `logs/` 폴더
