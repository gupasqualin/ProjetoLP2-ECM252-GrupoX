#!/usr/bin/env bash
# Sobe todo o ambiente dos microsservicos.
# Uso: ./scripts/up.sh [--rebuild]

set -euo pipefail

cd "$(dirname "$0")/.."

RECONSTRUIR=false

for argumento in "$@"; do
  case "$argumento" in
    --rebuild) RECONSTRUIR=true ;;
    *) echo "Argumento desconhecido: $argumento"; exit 1 ;;
  esac
done

if [ ! -f .env ]; then
  echo "Arquivo .env nao encontrado. Crie-o a partir de .env.example."
  exit 1
fi

if [ "$RECONSTRUIR" = true ]; then
  docker compose up -d --build
else
  docker compose up -d
fi

echo "Aguardando os microsservicos responderem..."

SERVICOS=(
  "gestao-empresas:3001"
  "dados-mercado:3002"
  "premissas-projecao:3003"
  "valuation:3004"
  "análise-sensibilidade:3005"
  "barramento-eventos:3006"
)

for servico in "${SERVICOS[@]}"; do
  nome="${servico%%:*}"
  porta="${servico##*:}"
  pronto=false

  for tentativa in $(seq 1 30); do
    if curl -fsS "http://localhost:${porta}/health" > /dev/null 2>&1; then
      pronto=true
      break
    fi
    sleep 2
  done

  if [ "$pronto" != true ]; then
    echo "O servico ${nome} nao respondeu a tempo. Logs:"
    docker compose logs --tail=50 "$nome"
    exit 1
  fi

done

echo "Ambiente pronto."
for servico in "${SERVICOS[@]}"; do
  nome="${servico%%:*}"
  porta="${servico##*:}"
  echo " ${nome} ....: http://localhost:${porta}/health"
done
