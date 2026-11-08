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

Se o barramento estiver fora do ar, os eventos ficam numa fila e são enviados, na ordem, quando ele voltar.

## Eventos consumidos

Para calcular o WACC sem depender do ms-dados-mercado, o serviço guarda uma cópia local dos dados de mercado, recebida pelo barramento:

- `MARKET_DATA_UPSERTED` e `MARKET_DATA_DELETED` (dados usados no WACC)
- `COMPANY_DELETED` (remove os dados da empresa)

Ao subir, o serviço se registra no barramento e recupera os eventos que perdeu; a cada 10 segundos ele repete isso.

Variáveis de ambiente: `EVENT_BUS_URL` (barramento) e `EVENTS_URL` (endereço em que o barramento entrega os eventos para este serviço).


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

O backend usa a cópia local dos dados de mercado da empresa (recebida pelos eventos), calcula o custo de capital próprio via CAPM, combina dívida e patrimônio para obter o WACC e salva esse valor em `discountRate` por compatibilidade com o restante do fluxo.

