#!/bin/sh
# docker compose 래퍼 — 앱(compose.yml) + 모니터링(compose.monitoring.yml) 두 파일과 루트 .env 를 항상 함께 지정
# 사용: infra/compose.sh ps | infra/compose.sh logs --tail=100 backend | infra/compose.sh up -d <서비스>
# (한 파일만 지정하면 나머지 컨테이너를 "주인 없는 컨테이너"로 보고 --remove-orphans 시 삭제할 수 있어 래퍼로 통일)
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
exec docker compose \
  -f "$ROOT/infra/docker/compose.yml" \
  -f "$ROOT/infra/docker/compose.monitoring.yml" \
  --env-file "$ROOT/.env" \
  "$@"
