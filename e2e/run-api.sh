#!/bin/sh
# Starts a fresh test API on 127.0.0.1:8000 with e2e/api.env (deletes the previous test database).
set -e
here="$(cd "$(dirname "$0")" && pwd)"
mkdir -p /tmp/bolt-e2e
rm -f /tmp/bolt-e2e/bolt.db /tmp/bolt-e2e/bolt.db-wal /tmp/bolt-e2e/bolt.db-shm
cd "$here/../backend"
set -a; . "$here/api.env"; set +a
exec python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
