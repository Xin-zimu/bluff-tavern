#!/usr/bin/env bash
set -euo pipefail

project_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$project_dir"

export NODE_ENV=production
export HOST="${HOST:-0.0.0.0}"
export PORT="${PORT:-3000}"
export CLIENT_ORIGIN="${CLIENT_ORIGIN:-*}"
export WEB_ROOT="${WEB_ROOT:-$project_dir/apps/web/dist}"

exec node apps/server/dist/main.js
