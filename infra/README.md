# 🏗️ 인프라 (infra/)

> 운영 서버에서 쓰는 docker compose · nginx 설정을 모아둔 폴더입니다.
> 앱 코드와 Dockerfile 은 `server/`, `client/` 에 있습니다.

---

## 구조

```
infra/
├── compose.sh                    # docker compose 래퍼 — compose 파일 + 루트 .env 를 항상 함께 지정
├── docker/
│   └── compose.yml               # db, backend, client, nginx, loki, alloy + 공용 네트워크·볼륨
├── alloy/config.alloy            # 로그 수집 — logs/*.log 를 읽어 Loki 로 전송 (운영·로컬 dev 공용)
├── loki/loki-config.yaml         # 로그 저장·검색 — 보관 60일 (운영·로컬 dev 공용)
├── nginx/
│   ├── conf.d/                   # nginx 가 파일 이름 순서대로 읽음 (번호 = 읽는 순서)
│   │   ├── 00-common.conf            # server_tokens off
│   │   ├── 01-cloudflare-realip.conf # Cloudflare 대역 → 실제 접속자 IP 복원
│   │   ├── 10-default-reject.conf    # 등록 안 된 도메인·IP 직접 접속 거부
│   │   ├── 20-http-redirect.conf     # 80 → https
│   │   ├── 30-frontend.conf          # academy-hk.com, www — 보안 헤더, X-Powered-By 숨김
│   │   └── 40-api.conf               # api — 업로드 10MB
│   ├── snippets/                 # 공통 조각 (conf.d 에서 include)
│   │   ├── ssl.conf                  # 인증서 경로 + TLS 버전·암호
│   │   ├── proxy.conf                # 공통 프록시 헤더 (Host, X-Real-IP, X-Forwarded-*)
│   │   ├── proxy-upgrade.conf        # WebSocket 업그레이드 헤더
│   │   ├── hsts.conf                 # HSTS
│   │   └── security-headers.conf     # 프론트 보안 헤더 (hsts + 4개)
│   └── ssl/                      # Cloudflare Origin 인증서 
└── host/
    └── journald/retention.conf   # 서버 OS 시스템 로그 보관 설정 (배포로 적용 안 됨 — 아래 "서버 OS 설정")
```

## 배포 (GitHub Actions — `.github/workflows/deploy.yml`)

`main` 에 push 되면:
1. backend / client 이미지를 ARM 러너에서 빌드 → GHCR 에 `:latest`, `:<커밋 SHA>` 로 push
2. 서버에 SSH 접속 → `git reset --hard origin/main`
3. nginx 설정 검사 (새 설정으로 일회용 컨테이너에서 `nginx -t`) — 실패하면 배포 중단
4. `up -d --no-deps backend client nginx` — 앱 교체, nginx 는 설정이 바뀐 경우에만 재생성, db 는 건드리지 않음
5. `nginx -s reload` — nginx 설정 변경 반영 (연결 끊김 없음)
6. 안 쓰는 이미지 정리 — 어떤 컨테이너도 쓰지 않고 만든 지 7일 지난 이미지 삭제 (`docker image prune -af --filter until=168h`)

다른 서비스가 바꿨다면 배포 후 서버에서 직접 `infra/compose.sh up -d <서비스>` 로 반영합니다.

---

## 로그 보관 정책

| 로그 | 위치 | 보관 | 설정 |
| --- | --- | --- | --- |
| Spring 로그 파일 | `logs/*.log` (app, error, auth, reservation, survey, setting) | 60일 (app 은 최대 1GB) | `server/src/main/resources/logback-spring.xml` `maxHistory` |
| Loki (로그 검색) | `loki-data` 볼륨 | 60일 | `infra/loki/loki-config.yaml` `retention_period` |
| 서버 시스템 로그 | `/var/log/journal` | 한 달, 최대 500MB | `host/journald/retention.conf` |
| 컨테이너 로그 (`docker logs`) | `/var/lib/docker/containers` | 컨테이너당 최대 30MB (10MB × 3, 보통 한 달치 이상) | `docker/compose.yml` `x-common.logging` — Docker 는 기간 기준 삭제를 지원하지 않아 크기로 제한 |

Spring 로그 → Alloy → Loki 구조, 라벨·쿼리 예시, 로그 추가 방법은 [`docs/LOGGING.md`](../docs/LOGGING.md) 를 참고하세요.

- **Loki · Alloy 는 배포 워크플로가 올리지 않습니다.** 서버에서 직접 `infra/compose.sh up -d loki alloy`, 설정 파일을 고친 뒤에는 `--force-recreate` 로 반영합니다.
- Loki 는 `127.0.0.1:3100` 에만 열려 있고 인증이 없습니다. 조회는 SSH 터널(`ssh -N -L 3100:127.0.0.1:3100 <사용자>@<서버>`)로 하며, 포트를 외부에 열지 않습니다.
