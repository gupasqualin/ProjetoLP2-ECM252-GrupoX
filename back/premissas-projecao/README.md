# Microsserviço 3 - Premissas de Projeção

Serviço responsável por armazenar as premissas de projeção usadas no modelo DCF e publicar eventos quando premissas são criadas/atualizadas/removidas. A taxa de desconto não é informada manualmente: ela é calculada automaticamente via CAPM e consolidada no WACC usando os dados de mercado da empresa.

## Dados armazenados

- `companyId` (inteiro positivo)
- `projectionYears` (número de anos projetados, inteiro)
- `riskFreeRate` (taxa livre de risco, número entre 0 e 1)
- `marketRiskPremium` (prêmio de risco de mercado, número entre 0 e 1)
- `revenueGrowthByYear` (array de taxas de crescimento por ano)
- `projectedEbitdaMargin` (margem EBITDA projetada, 0..1)
- `capexPercentOfRevenue` (CAPEX como percent. da receita, 0..1)
- `workingCapitalChangePercentOfRevenue` (variação capital de giro como percent. da receita, -1..1)
- `perpetualGrowthRate` (g, taxa de crescimento perpétua, 0..discountRate)
- `terminalValueMethod` ("GORDON" | "EXIT_MULTIPLE")
- `exitMultiple` (número, obrigatório quando `terminalValueMethod` é `EXIT_MULTIPLE`)
- `discountRate` (WACC calculado automaticamente pelo backend)
- `updatedAt` (data/hora da última atualização)

## Endpoints

- `GET /health` - status do microsserviço
- `GET /premissas` - lista todas as premissas
- `GET /premissas/:companyId` - consulta premissas por empresa
- `POST /premissas` - cria premissas para uma empresa
- `PUT /premissas/:companyId` - atualiza premissas existentes
- `DELETE /premissas/:companyId` - remove premissas

## Eventos publicados

O serviço publica eventos no barramento (por padrão `http://localhost:3006`) nos seguintes tipos:

- `ASSUMPTIONS_UPSERTED` (payload: premissas criadas/atualizadas)
- `ASSUMPTIONS_DELETED` (companyId)

## Como executar

1. Instale as dependências:

```bash
npm install
```

2. Rode o serviço:

```bash
npm run dev
```

Por padrão o serviço escuta em `http://localhost:3003` e usa `EVENT_BUS_URL=http://localhost:3006`.

## Exemplo

POST /premissas payload de exemplo:

```json
{
	"companyId": 3,
	"projectionYears": 5,
	"riskFreeRate": 0.045,
	"marketRiskPremium": 0.055,
	"revenueGrowthByYear": [0.10, 0.08, 0.07, 0.05, 0.03],
	"projectedEbitdaMargin": 0.25,
	"capexPercentOfRevenue": 0.08,
	"workingCapitalChangePercentOfRevenue": 0.05,
	"perpetualGrowthRate": 0.03,
	"terminalValueMethod": "GORDON",
	"exitMultiple": null
}
```

O backend busca os dados de mercado da empresa, calcula o custo de capital próprio via CAPM, combina dívida e patrimônio para obter o WACC e salva esse valor em `discountRate` por compatibilidade com o restante do fluxo.

