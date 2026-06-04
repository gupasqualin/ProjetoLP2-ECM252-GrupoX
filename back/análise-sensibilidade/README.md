# Microsservico 5 - Análise de sensibilidade

Servico responsavel por gerar matrizes de sensibilidade DCF com base nos dados do ms-valuation.

## Objetivo

- Consumir um valuation base por empresa no ms-valuation
- Recalcular localmente o DCF por celula (sem chamar o ms-valuation para cada combinacao)
- Mostrar o impacto no preco justo por acao ao variar WACC, crescimento perpetuo (g) e margem EBITDA

Padrao de porta: 3005

## Variaveis de ambiente

- PORT - porta do microsservico (padrao: 3005)
- VALUATION_ENGINE_URL - URL base do ms-valuation (padrao: http://localhost:3004)

## Endpoints

- GET /health - status do servico e defaults dos steps
- POST /sensitivity/:companyId/matrices - gera as matrizes de sensibilidade

## Defaults de Steps

Se o usuario nao enviar steps no corpo da requisicao, o servico usa:

- waccSteps: [-0.02, -0.01, 0, 0.01, 0.02]
- gSteps: [-0.01, -0.005, 0, 0.005, 0.01]
- ebitdaMarginSteps: [-0.03, -0.015, 0, 0.015, 0.03]

## Regras por celula

- Se wacc <= g, a celula retorna fairValuePerShare: null
- Se fairValuePerShare < 0, o valor negativo e mantido
- fairValuePerShare e arredondado para 2 casas decimais

## Exemplo de requisicao

```http
POST /sensitivity/1/matrices
Content-Type: application/json
```

```json
{
  "syncFromServices": true,
  "waccSteps": [-0.02, -0.01, 0, 0.01, 0.02],
  "gSteps": [-0.01, -0.005, 0, 0.005, 0.01],
  "ebitdaMarginSteps": [-0.03, -0.015, 0, 0.015, 0.03]
}
```

## Formulas financeira
1. Projecao anual de FCFF
2. Desconto dos FCFF ao WACC da celula
3. Valor terminal via Gordon: TV = FCF_(N+1) / (wacc - g)
4. EnterpriseValue = SomaPV(FCFF) + PV(TV)
5. EquityValue = EnterpriseValue - NetDebt
6. PrecoJusto = EquityValue / SharesOutstanding
