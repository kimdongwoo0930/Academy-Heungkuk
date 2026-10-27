#!/bin/sh
# docker compose 래퍼 — compose.yml 과 루트 .env 를 항상 함께 지정
# 사용: infra/compose.sh ps | infra/compose.sh logs --tail=100 backend | infra/compose.sh up -d <서비스>
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
exec docker compose \
  -f "$ROOT/infra/docker/compose.yml" \
  --env-file "$ROOT/.env" \
  "$@"
