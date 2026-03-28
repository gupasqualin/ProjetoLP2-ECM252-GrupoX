# Microsserviço 1 - Gestão de Empresas

Catálogo central de empresas para análise no DecisionDCF.

## Função

- Registrar empresa (`name`, `ticker`, `sector`)
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

Servidor padrão: `http://localhost:3001`

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
