# Microsservico 6 - Barramento de Eventos

Unico ponto de comunicacao entre os microsservicos. Nenhum microsservico chama outro
diretamente: quem muda um dado publica um evento aqui, e o barramento entrega esse evento
a todos os microsservicos que se registraram para recebe-lo.

Porta padrao: `3006`

## Como funciona

1. Cada microsservico que precisa de dados de outro se registra quando sobe
   (`POST /subscribe`), informando os tipos de evento e o endereco em que quer recebe-los.
2. Quem altera um dado publica um evento (`POST /publish`). O barramento numera o evento,
   guarda no historico e entrega para os registrados.
3. Um microsservico que estava fora do ar recupera o que perdeu pelo historico
   (`GET /events?after=<ultimo evento recebido>`).

Se o proprio barramento estiver fora do ar, os microsservicos continuam funcionando com as
copias locais que ja tem, e quem publica guarda os eventos numa fila ate ele voltar.

## Tipos de evento

| Evento | Publicado por | Recebido por |
|---|---|---|
| `COMPANY_UPSERTED` | gestao-empresas | valuation, analise-sensibilidade |
| `COMPANY_DELETED` | gestao-empresas | premissas-projecao, valuation, analise-sensibilidade |
| `MARKET_DATA_UPSERTED` / `MARKET_DATA_DELETED` | dados-mercado | premissas-projecao, valuation, analise-sensibilidade |
| `ASSUMPTIONS_UPSERTED` / `ASSUMPTIONS_DELETED` | premissas-projecao | valuation, analise-sensibilidade |
| `VALUATION_RECALCULATE_REQUESTED` | gestao-empresas | valuation |

## Endpoints

- `GET /health` - status, quantidade de eventos guardados e registrados
- `GET /subscribers` - quem recebe cada tipo de evento
- `POST /subscribe` - registra `{ eventType, url }`
- `DELETE /subscribe` - remove um registro
- `POST /publish` - publica `{ eventType, payload?, companyId? }`
- `GET /events?after=0&types=A,B` - historico de eventos depois do numero `after`,
  opcionalmente filtrado por tipo

O historico fica em memoria: se o barramento reiniciar, ele recomeca a contagem do 1 e os
microsservicos percebem isso sozinhos.
