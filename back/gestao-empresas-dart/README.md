# Microsserviço 1 - Gestão de Empresas (Dart)

Reimplementação em **Dart** do microsserviço `gestao-empresas`, que antes era feito em Node.js.
Ele mantém as mesmas rotas, a mesma porta (3001) e os mesmos eventos publicados no barramento,
então o front-end e os outros microsserviços continuam funcionando sem nenhuma mudança.

Foi feito com o [shelf](https://pub.dev/packages/shelf) (servidor HTTP) e o
[shelf_router](https://pub.dev/packages/shelf_router) (rotas).

## Endpoints

| Método | Rota | Descrição | Evento publicado |
|---|---|---|---|
| `GET` | `/health` | Status do microsserviço | — |
| `GET` | `/empresas` | Lista as empresas cadastradas | — |
| `POST` | `/empresas` | Cadastra uma empresa (`name`, `ticker`, `sector`) | `COMPANY_UPSERTED` |
| `DELETE` | `/empresas/:id` | Remove uma empresa | `COMPANY_DELETED` |
| `POST` | `/valuations/recalculate` | Pede o recálculo do valuation (`companyId`) | `VALUATION_RECALCULATE_REQUESTED` |

Exemplo de `POST /empresas`:

```json
{
  "name": "Vale",
  "ticker": "VALE3",
  "sector": "Mineração"
}
```

## Variáveis de ambiente

| Variável | Padrão | Descrição |
|---|---|---|
| `PORT` | `3001` | Porta do servidor |
| `EVENT_BUS_URL` | `http://localhost:3006` | Endereço do barramento de eventos |

## Como executar

Com o [Dart SDK](https://dart.dev/get-dart) (ou o Flutter, que já inclui o Dart) instalado:

```bash
dart pub get
dart run bin/server.dart
```

Para rodar os testes:

```bash
dart test
```

Com Docker, a partir da pasta `back`, o serviço sobe junto com os demais:

```bash
./scripts/up.sh --rebuild
```
