# Microsserviço 2 - Market Data

Serviço responsável por armazenar os dados atuais de balanço usados no modelo DCF.

## Dados armazenados

- `companyId` (inteiro positivo)
- `cash` (caixa)
- `netDebt` (dívida líquida)
- `sharesOutstanding` (total de ações emitidas)
- `updatedAt` (data/hora da última atualização)

## Endpoints

- `GET /health` - status do microsserviço
- `GET /market-data` - lista todos os registros
- `GET /market-data/:companyId` - consulta dados por empresa
- `POST /market-data` - cria registro de dados de mercado
- `PUT /market-data/:companyId` - atualiza registro existente
- `DELETE /market-data/:companyId` - remove registro

## Exemplo:

```json
{
  "companyId": 3,
  "cash": 450000000,
  "netDebt": 1200000000,
  "sharesOutstanding": 980000000
}
```
