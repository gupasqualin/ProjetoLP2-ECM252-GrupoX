# Microsservico Valuation

Servico responsavel por processar dados financeiros e calcular o valuation por DCF.

## Como executar

```bash
npm install
npm run dev
```

Porta padrao: `3004`

## Endpoints principais

- `GET /health`
- `GET /events/types`
- `POST /events`
- `GET /state`
- `GET /valuations`
- `GET /valuation/:companyId`
- `POST /valuation/:companyId/recalculate`
- `POST /valuation/recalculate-all`
- `POST /valuation/:companyId/sync-from-services`
