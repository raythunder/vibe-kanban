#!/bin/bash

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

cd "$REPO_ROOT"

echo "📦 Building local Vibe Kanban package..."
pnpm run prepack

echo ""
echo "🔗 Registering global command: vibe-kanban"
npm link

echo ""
echo "✅ Global command installed."
echo "Run: vibe-kanban --help"
