# Microsservico 5 - Análise de sensibilidade

Servico responsavel por gerar matrizes de sensibilidade DCF por empresa.

## Objetivo

- Receber pelo barramento de eventos os dados de empresas, de mercado e as premissas
- Calcular localmente o DCF de cada celula, sem chamar nenhum outro microsservico
- Mostrar o impacto no preco justo por acao ao variar WACC, crescimento perpetuo (g) e margem EBITDA

## Independencia dos outros microsservicos

Os dados ficam numa copia local, alimentada pelos eventos `COMPANY_*`, `MARKET_DATA_*` e
`ASSUMPTIONS_*`. Ao subir, o servico se registra no barramento e recupera os eventos que
perdeu; a cada 10 segundos ele repete isso. Assim os cenarios continuam sendo gerados mesmo
com o ms-valuation ou qualquer outro microsservico fora do ar.

Padrao de porta: 3005

## Variaveis de ambiente

- PORT - porta do microsservico (padrao: 3005)
- EVENT_BUS_URL - endereco do barramento de eventos (padrao: http://localhost:3006)
- EVENTS_URL - endereco em que o barramento entrega os eventos para este servico
  (padrao: http://localhost:3005/events)

## Endpoints

- GET /health - status do servico e defaults dos steps
- POST /events - recebe os eventos do barramento
- POST /sensitivity/:companyId/matrices - gera as matrizes de sensibilidade

## Defaults de Steps

Se o usuario nao enviar steps no corpo da requisicao, o servico usa:

- waccSteps: [-0.02, -0.01, 0, 0.01, 0.02]
- gSteps: [-0.01, -0.005, 0, 0.005, 0.01]
- ebitdaMarginSteps: [-0.03, -0.015, 0, 0.015, 0.03]

## Regras por celula

- No metodo de Gordon, se wacc <= g, a celula retorna fairValuePerShare: null
- Se fairValuePerShare < 0, o valor negativo e mantido
- fairValuePerShare e arredondado para 2 casas decimais

## Exemplo de requisicao

```http
POST /sensitivity/1/matrices
Content-Type: application/json
```

```json
{
  "waccSteps": [-0.02, -0.01, 0, 0.01, 0.02],
  "gSteps": [-0.01, -0.005, 0, 0.005, 0.01],
  "ebitdaMarginSteps": [-0.03, -0.015, 0, 0.015, 0.03]
}
```

Se a empresa ainda nao tiver dados de mercado e premissas, a resposta e `422`.

## Formulas financeira
1. Projecao anual de FCFF
2. Desconto dos FCFF ao WACC da celula
3. Valor terminal, pelo metodo da empresa (igual ao ms-valuation):
   - Gordon: TV = FCF_(N+1) / (wacc - g)
   - Multiplo de saida: TV = EBITDA do ultimo ano x multiplo (g nao altera o resultado)
4. EnterpriseValue = SomaPV(FCFF) + PV(TV)
5. EquityValue = EnterpriseValue - NetDebt
6. PrecoJusto = EquityValue / SharesOutstanding
