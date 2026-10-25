# ---------- Estagio 1: instalacao ----------
FROM node:18 AS build

WORKDIR /app

COPY barramento-eventos/package.json barramento-eventos/
COPY dados-mercado/package.json dados-mercado/
COPY gestao-empresas/package.json gestao-empresas/
COPY premissas-projecao/package.json premissas-projecao/
COPY valuation/package.json valuation/
COPY análise-sensibilidade/package.json análise-sensibilidade/

RUN npm install --prefix barramento-eventos \
    && npm install --prefix dados-mercado \
    && npm install --prefix gestao-empresas \
    && npm install --prefix premissas-projecao \
    && npm install --prefix valuation \
    && npm install --prefix análise-sensibilidade

COPY . .

# ---------- Estagio 2: execucao ----------
FROM node:18-slim

WORKDIR /app

COPY --from=build /app /app

EXPOSE 3001 3002 3003 3004 3005 3006

CMD ["node", "barramento-eventos/src/server_barramento-eventos.js"]
