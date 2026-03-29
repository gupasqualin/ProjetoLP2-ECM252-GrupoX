# Microsserviço 1 - Gestão de Empresas

Empresas que serao cadastradas na plataforma, pelo proprio usuário, para realização da análise.

## Função

- Registrar empresa (`name`, `ticker`, `sector`) 
TICKER = CÓDIGO AÇÃO EMPRESA, EXEMPLO: 
APPLE - AAPL34
- Listar empresas cadastradas

## Como executar

1. Instale as dependências:

```bash
npm install
```

2. Rode o serviço:

```bash
npm run dev
```
## Endpoints

- `GET /health` - status do microsserviço
- `GET /empresas` - lista todas as empresas
- `POST /empresas` - cadastra nova empresa

### Exemplo `POST /empresas`

```json
{
  "name": "Vale",
  "ticker": "VALE3",
  "sector": "Mineração"
}
```
