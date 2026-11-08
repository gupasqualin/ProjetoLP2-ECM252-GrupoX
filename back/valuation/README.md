# Microsservico Valuation

Servico responsavel por processar dados financeiros e calcular o valuation por DCF.

## Independencia dos outros microsservicos

Este servico **nao chama nenhum outro microsservico**. Empresas, dados de mercado e
premissas chegam pelos eventos do barramento e ficam guardados numa copia local:

- ao subir, o servico se registra no barramento (`POST /subscribe`) e recupera os
  eventos que perdeu enquanto estava fora do ar (`GET /events?after=...`);
- a cada 10 segundos ele repete isso, para se recuperar se o barramento reiniciar
  ou se alguma entrega falhar.

Assim, o calculo continua funcionando mesmo com os outros microsservicos fora do ar.

## Como executar

```bash
npm install
npm run dev
```

Porta padrao: `3004`

## Variaveis de ambiente

- `PORT` - porta do servico (padrao: 3004)
- `EVENT_BUS_URL` - endereco do barramento de eventos (padrao: http://localhost:3006)
- `EVENTS_URL` - endereco em que o barramento entrega os eventos para este servico
  (padrao: http://localhost:3004/events)

## Endpoints principais

- `GET /health`
- `GET /events/types`
- `POST /events` - recebe os eventos do barramento
- `GET /state` - mostra o que o servico ja recebeu de cada empresa
- `GET /valuations`
- `GET /valuation/:companyId`
- `POST /valuation/:companyId/recalculate` - calcula o valuation com a copia local
- `POST /valuation/recalculate-all`
