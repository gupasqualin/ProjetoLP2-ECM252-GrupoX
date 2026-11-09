#!/usr/bin/env bash
# Mostra que os microsservicos nao dependem uns dos outros: desliga um
# microsservico por vez (inclusive o barramento) e testa as funcionalidades
# de TODOS os outros. No fim, cadastra de novo os dados de exemplo.
#
# Uso (com o back-end rodando):
#   ./scripts/teste-independencia.sh        # Docker Compose
#   ./scripts/teste-independencia.sh k8s    # Kubernetes

set -uo pipefail

cd "$(dirname "$0")/.."

MODO="${1:-docker}"
case "$MODO" in
  docker) BASE=3000; ARG_EXEMPLO="" ;;
  k8s) BASE=30000; ARG_EXEMPLO="30000" ;;
  *) echo "Uso: ./scripts/teste-independencia.sh [docker|k8s]"; exit 1 ;;
esac

url() { echo "http://localhost:$((BASE + $1))"; }
SERVICOS=(gestao-empresas dados-mercado premissas-projecao valuation analise-sensibilidade barramento-eventos)

desligar() {
  if [ "$MODO" = k8s ]; then
    kubectl scale deployment "$1" -n valuation --replicas=0 > /dev/null
    kubectl wait --for=delete pod -l app="$1" -n valuation --timeout=60s > /dev/null 2>&1
  else
    docker compose stop -t 2 "$1" > /dev/null 2>&1
  fi
}

ligar() {
  if [ "$MODO" = k8s ]; then
    kubectl scale deployment "$1" -n valuation --replicas=1 > /dev/null
    kubectl rollout status deployment "$1" -n valuation --timeout=120s > /dev/null
  else
    docker compose start "$1" > /dev/null 2>&1
  fi
  sleep 3
}

echo "Preparando os dados de exemplo..."
./scripts/dados-exemplo.sh $ARG_EXEMPLO > /dev/null || { echo "O back-end esta rodando?"; exit 1; }

ID=$(curl -s "$(url 1)/empresas" \
  | grep -o '"id":[0-9]*,"name":"[^"]*","ticker":"PETR4"' | grep -o '"id":[0-9]*' | cut -d: -f2)
PREMISSAS="{\"companyId\":$ID,\"projectionYears\":5,\"riskFreeRate\":0.105,\"marketRiskPremium\":0.05,\"revenueGrowthByYear\":[0.03,0.03,0.02,0.02,0.02],\"projectedEbitdaMargin\":0.45,\"capexPercentOfRevenue\":0.14,\"workingCapitalChangePercentOfRevenue\":0.01,\"perpetualGrowthRate\":0.03,\"terminalValueMethod\":\"GORDON\"}"
JSON=(-H 'Content-Type: application/json')

OK=0
FALHAS=0
checar() {
  local descricao="$1"; shift
  local status
  status=$(curl -s -o /dev/null -w '%{http_code}' --max-time 15 "$@")
  if [[ "$status" == 2* ]]; then
    printf '    ok     %-38s (HTTP %s)\n' "$descricao" "$status"; OK=$((OK + 1))
  else
    printf '    FALHA  %-38s (HTTP %s)\n' "$descricao" "$status"; FALHAS=$((FALHAS + 1))
  fi
}

salvar_premissas() {
  # O servico de premissas perde as proprias premissas se for reiniciado
  # (dados em memoria); nesse caso, cria de novo. O que se testa aqui e que
  # ele calcula o WACC sem consultar o servico de dados de mercado.
  if [ "$(curl -s -o /dev/null -w '%{http_code}' "$(url 3)/premissas/$ID")" = 200 ]; then
    checar "premissas: salvar premissas" "${JSON[@]}" -X PUT "$(url 3)/premissas/$ID" -d "$PREMISSAS"
  else
    checar "premissas: salvar premissas" "${JSON[@]}" -X POST "$(url 3)/premissas" -d "$PREMISSAS"
  fi
}

testar_os_outros() {
  local desligado="$1"
  [ "$desligado" != gestao-empresas ] && checar "gestao-empresas: listar empresas" "$(url 1)/empresas"
  [ "$desligado" != dados-mercado ] && checar "dados-mercado: listar dados" "$(url 2)/market-data"
  [ "$desligado" != premissas-projecao ] && salvar_premissas
  [ "$desligado" != valuation ] && checar "valuation: calcular valuation" -X POST "$(url 4)/valuation/$ID/recalculate"
  [ "$desligado" != analise-sensibilidade ] && checar "analise-sensibilidade: gerar cenarios" "${JSON[@]}" -X POST "$(url 5)/sensitivity/$ID/matrices" -d '{}'
  return 0
}

for servico in "${SERVICOS[@]}"; do
  echo ">> Desligando $servico e testando os outros:"
  desligar "$servico"
  testar_os_outros "$servico"
  ligar "$servico"
done

echo
echo "Recadastrando os dados de exemplo (os servicos reiniciados perderam os dados em memoria)..."
./scripts/dados-exemplo.sh $ARG_EXEMPLO > /dev/null

echo
echo "Resultado: $OK testes ok, $FALHAS falha(s)."
[ "$FALHAS" -eq 0 ]
