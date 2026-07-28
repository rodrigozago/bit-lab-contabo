#!/usr/bin/env bash
# setup.sh — Inicializa o ambiente de desenvolvimento do Bordado Digital
set -euo pipefail

echo "🪡  Bordado Digital — Setup"
echo "========================"

# Verifica dependências
command -v node >/dev/null 2>&1 || { echo "❌ Node.js não encontrado. Instale >= 20"; exit 1; }
command -v pnpm >/dev/null 2>&1 || { echo "❌ pnpm não encontrado. Execute: corepack enable"; exit 1; }
command -v docker >/dev/null 2>&1 || echo "⚠️  Docker não encontrado — necessário para build de produção"

echo ""
echo "📦 Instalando dependências..."
pnpm install

echo ""
echo "🔨 Buildando package shared..."
pnpm --filter @ponto-studio/shared build

echo ""
echo "✅ Setup completo!"
echo ""
echo "Para rodar em desenvolvimento:"
echo "  pnpm dev"
echo ""
echo "Para rodar via Docker:"
echo "  docker-compose up --build"
