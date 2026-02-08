#!/bin/bash
# Run happy with local dev configuration
cd "$(dirname "$0")"
exec npx tsx --env-file .env.local src/index.ts "$@"
