# DecisionDCF

**Quanto vale uma empresa? Descubra em minutos, sem planilha.**

## Sobre o projeto

Quem já tentou calcular o valor de uma empresa na mão sabe como é: uma planilha enorme, fórmulas ligadas umas às outras e o risco de um erro numa célula estragar tudo no final. O DecisionDCF existe para tirar esse trabalho do caminho.

A aplicação calcula o valor intrínseco de uma empresa pelo método do Fluxo de Caixa Descontado (DCF). Você informa os dados e as premissas, e o sistema faz o resto, devolvendo o preço-alvo da ação para você comparar com o preço de mercado e decidir se vale a pena comprar.

## O que você pode fazer

- **Cadastrar empresas** e manter todas as análises organizadas em um só lugar.
- **Inserir os dados do balanço** de cada empresa, sem precisar montar tabelas.
- **Definir suas premissas**, como taxa de crescimento e taxa de desconto, e testar como cada uma muda o resultado.
- **Receber o preço-alvo na hora**, calculado automaticamente a partir das suas premissas.
- **Comparar cenários** (por exemplo, um otimista e um conservador) para entender o quanto o valor da empresa depende das suas apostas.

## Por que usar

- **Menos erros.** O cálculo é sempre o mesmo e não depende de fórmulas copiadas de planilha em planilha.
- **Mais rapidez.** Mudar uma premissa e ver o novo resultado leva segundos, não uma tarde.
- **Decisões mais seguras.** Em vez de investir por palpite, você tem um número baseado nos dados da empresa e nas suas próprias hipóteses.

O DecisionDCF é voltado para investidores e analistas, mas também serve para quem está começando e quer entender como o valuation funciona na prática.

## Agora no celular

No segundo semestre, o DecisionDCF ganhou um **app mobile em Flutter**: toda a análise, do cadastro da empresa até os cenários, cabe no bolso.

| Aba | O que você faz nela |
|---|---|
| **Empresas** | Cadastra, lista e remove empresas, e pede o recálculo do valuation |
| **Mercado** | Informa os dados de mercado e do balanço (preço da ação, dívida, receita, EBITDA...) |
| **Premissas** | Define o crescimento da receita ano a ano, margens, valor terminal (Gordon ou múltiplo de saída) e vê o WACC calculado |
| **Valuation** | Vê o preço justo da ação, o potencial de valorização e o fluxo de caixa projetado |
| **Cenários** | Vê como o preço justo muda variando WACC, crescimento perpétuo e margem EBITDA |

## Arquitetura

O back-end é formado por microsserviços que conversam por um barramento de eventos. Os front-ends acessam os microsserviços por requisições HTTP.

| Microsserviço | Pasta | Porta | Linguagem |
|---|---|---|---|
| Gestão de Empresas | `back/gestao-empresas-dart` | 3001 | **Dart** |
| Dados de Mercado | `back/dados-mercado` | 3002 | Node.js |
| Premissas de Projeção | `back/premissas-projecao` | 3003 | Node.js |
| Valuation | `back/valuation` | 3004 | Node.js |
| Análise de Sensibilidade | `back/análise-sensibilidade` | 3005 | Node.js |
| Barramento de Eventos | `back/barramento-eventos` | 3006 | Node.js |

- `front/`: front-end web em React (parte 1).
- `front_mobile/`: app mobile em Flutter (parte 2).
- `back/gestao-empresas`: versão original em Node.js do microsserviço de Gestão de Empresas, mantida como referência da reimplementação em Dart.

## Como executar

### Back-end com Docker

Dentro da pasta `back`:

```bash
cp .env.example .env
./scripts/up.sh --rebuild
```

O script constrói as imagens, sobe os 6 microsserviços e espera todos responderem em `/health`. Para desligar: `docker compose down`.

### Back-end com Kubernetes

Dentro da pasta `back`, com um cluster Kubernetes ativo (por exemplo, o do Docker Desktop):

```bash
docker compose build
./kubernetes/up.sh up
```

Também existem `./kubernetes/up.sh status` (mostra os pods) e `./kubernetes/up.sh down` (remove tudo). Os serviços ficam expostos nas portas 30001 a 30006.

### App mobile (Flutter)

Dentro da pasta `front_mobile`, com o back-end rodando:

| Onde rodar | Comando |
|---|---|
| Emulador Android | `flutter run` |
| Navegador | `flutter run -d chrome` |
| Celular de verdade (mesma rede Wi-Fi) | `flutter run --dart-define=API_HOST=<IP do computador>` |
| Back-end no Kubernetes | acrescente `--dart-define=API_PORTA_BASE=30000` |

Testes automatizados: `flutter test`.

## Integrantes

| RA | Nome |
|---|---|
| 23.00209-3 | Enzo Medeiros Grando |
| 23.00438-0 | Gustavo Henrique Lamberti Widonsck |
| 23.00531-9 | Gustavo Henrique Rivero Pasqualin |
| 23.01078-9 | João Victor Pessoa de Lima dos Anjos |
| 23.00161-5 | Pedro Kuba Bloise |
