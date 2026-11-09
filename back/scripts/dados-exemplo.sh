#!/usr/bin/env bash
# Cadastra empresas de exemplo, com dados de mercado e premissas, para
# demonstrar o DecisionDCF.
#
# Uso (com o back-end rodando):
#   ./scripts/dados-exemplo.sh          # Docker Compose (portas 3001 a 3006)
#   ./scripts/dados-exemplo.sh 30000    # Kubernetes (portas 30001 a 30006)
#
# Os valores sao APROXIMADOS e servem so para demonstracao. Todos os valores
# em dinheiro e a quantidade de acoes estao em MILHOES, para ficarem na mesma
# escala (ex.: receita 490000 = R$ 490 bilhoes; acoes 13044 = 13,044 bilhoes).

set -euo pipefail

BASE="${1:-3000}"
EMPRESAS="http://localhost:$((BASE + 1))"
MERCADO="http://localhost:$((BASE + 2))"
PREMISSAS="http://localhost:$((BASE + 3))"
VALUATION="http://localhost:$((BASE + 4))"

# Envia JSON em UTF-8 (pela entrada padrao) e devolve "<status> <corpo>".
enviar() {
  local metodo="$1" url="$2"
  curl -s -X "$metodo" "$url" -H 'Content-Type: application/json; charset=utf-8' \
    --data-binary @- -w ' %{http_code}'
}

status_de() { echo "${1##* }"; }

# Cria ou atualiza (POST; se ja existir, PUT).
salvar() {
  local url_criar="$1" url_atualizar="$2" json="$3" resposta
  resposta=$(echo "$json" | enviar POST "$url_criar")
  if [ "$(status_de "$resposta")" = 409 ]; then
    resposta=$(echo "$json" | enviar PUT "$url_atualizar")
  fi
  status_de "$resposta"
}

id_da_empresa() {
  curl -s "$EMPRESAS/empresas" \
    | grep -o "\"id\":[0-9]*,\"name\":\"[^\"]*\",\"ticker\":\"$1\"" \
    | grep -o '"id":[0-9]*' | cut -d: -f2
}

cadastrar() {
  local nome="$1" ticker="$2" setor="$3" mercado="$4" premissas="$5" id

  echo "{\"name\":\"$nome\",\"ticker\":\"$ticker\",\"sector\":\"$setor\"}" \
    | enviar POST "$EMPRESAS/empresas" > /dev/null
  id=$(id_da_empresa "$ticker")
  if [ -z "$id" ]; then
    echo "  $ticker: nao foi possivel cadastrar a empresa."
    return 1
  fi

  local s_mercado s_premissas
  s_mercado=$(salvar "$MERCADO/market-data" "$MERCADO/market-data/$id" "{\"companyId\":$id,$mercado}")
  sleep 1 # tempo do evento de dados de mercado chegar no servico de premissas
  s_premissas=$(salvar "$PREMISSAS/premissas" "$PREMISSAS/premissas/$id" "{\"companyId\":$id,$premissas}")
  sleep 1
  curl -s -o /dev/null -X POST "$VALUATION/valuation/$id/recalculate"

  echo "  $ticker (id $id): dados de mercado $s_mercado, premissas $s_premissas"
}

echo "Cadastrando empresas de exemplo em localhost:$((BASE + 1))..."

cadastrar "Petrobras" "PETR4" "Energia" \
  '"currentStockPrice":38.5,"sharesOutstanding":13044,"beta":1.1,"totalDebt":330000,"costOfDebt":0.08,"effectiveTaxRate":0.34,"cash":70000,"netDebt":260000,"revenue":490000,"ebitda":230000,"ebit":160000,"capex":70000,"depreciation":70000,"workingCapital":20000' \
  '"projectionYears":5,"riskFreeRate":0.105,"marketRiskPremium":0.05,"revenueGrowthByYear":[0.03,0.03,0.02,0.02,0.02],"projectedEbitdaMargin":0.45,"capexPercentOfRevenue":0.14,"workingCapitalChangePercentOfRevenue":0.01,"perpetualGrowthRate":0.03,"terminalValueMethod":"GORDON"'

cadastrar "Vale" "VALE3" "Mineração" \
  '"currentStockPrice":60.5,"sharesOutstanding":4270,"beta":0.9,"totalDebt":80000,"costOfDebt":0.07,"effectiveTaxRate":0.25,"cash":25000,"netDebt":55000,"revenue":210000,"ebitda":85000,"ebit":65000,"capex":32000,"depreciation":20000,"workingCapital":10000' \
  '"projectionYears":5,"riskFreeRate":0.105,"marketRiskPremium":0.05,"revenueGrowthByYear":[0.04,0.04,0.03,0.03,0.03],"projectedEbitdaMargin":0.4,"capexPercentOfRevenue":0.15,"workingCapitalChangePercentOfRevenue":0.01,"perpetualGrowthRate":0.025,"terminalValueMethod":"EXIT_MULTIPLE","exitMultiple":5'

cadastrar "WEG" "WEGE3" "Bens de Capital" \
  '"currentStockPrice":40,"sharesOutstanding":4197,"beta":0.8,"totalDebt":3000,"costOfDebt":0.1,"effectiveTaxRate":0.2,"cash":6000,"netDebt":0,"revenue":38000,"ebitda":8000,"ebit":7000,"capex":1500,"depreciation":1000,"workingCapital":5000' \
  '"projectionYears":5,"riskFreeRate":0.105,"marketRiskPremium":0.05,"revenueGrowthByYear":[0.12,0.1,0.09,0.08,0.07],"projectedEbitdaMargin":0.21,"capexPercentOfRevenue":0.04,"workingCapitalChangePercentOfRevenue":0.02,"perpetualGrowthRate":0.04,"terminalValueMethod":"EXIT_MULTIPLE","exitMultiple":18'

cadastrar "Magazine Luiza" "MGLU3" "Varejo" \
  '"currentStockPrice":10,"sharesOutstanding":700,"beta":1.6,"totalDebt":6000,"costOfDebt":0.14,"effectiveTaxRate":0.34,"cash":3000,"netDebt":3000,"revenue":37000,"ebitda":2800,"ebit":1500,"capex":800,"depreciation":1300,"workingCapital":2000' \
  '"projectionYears":5,"riskFreeRate":0.105,"marketRiskPremium":0.05,"revenueGrowthByYear":[0.06,0.06,0.05,0.05,0.04],"projectedEbitdaMargin":0.08,"capexPercentOfRevenue":0.025,"workingCapitalChangePercentOfRevenue":0.01,"perpetualGrowthRate":0.035,"terminalValueMethod":"GORDON"'

echo "Pronto. Abra o app para ver os resultados."
