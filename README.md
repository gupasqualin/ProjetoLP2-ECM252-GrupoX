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

O back-end é formado por microsserviços que conversam **somente** por um barramento de eventos. Os front-ends acessam os microsserviços por requisições HTTP.

**Nenhum microsserviço chama outro diretamente.** Quem precisa de dados de outro serviço (por exemplo, o valuation precisa dos dados de mercado e das premissas) guarda uma cópia local, recebida pelos eventos. Ao subir, cada serviço recupera no barramento os eventos que perdeu enquanto estava fora do ar. Por isso, se qualquer microsserviço cair, inclusive o barramento, os outros continuam funcionando.

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

## O que instalar

| Ferramenta | Para quê |
|---|---|
| **Docker Desktop** | Rodar o back-end (Docker Compose e o Kubernetes que vem nele, no modo **kubeadm**) |
| **Git Bash** (no Windows) | Rodar os scripts `.sh`. No PowerShell ou no Prompt de Comando eles não funcionam |
| **Flutter SDK** | Rodar e testar o app mobile (o Dart já vem junto) |
| **Android Studio** | Criar o emulador Android, com o *Android SDK Command-line Tools* instalado em SDK Manager → SDK Tools |
| **Node.js** | Só para rodar o front-end web da parte 1 |

## Como executar

Todos os comandos abaixo são para o **Git Bash** (Windows) ou o terminal do Linux/macOS.

### Back-end com Docker

Dentro da pasta `back`:

```bash
cp .env.example .env
./scripts/up.sh --rebuild
```

O script constrói as imagens, sobe os 6 microsserviços e espera todos responderem em `/health`. Para desligar: `docker compose down`.

### Back-end com Kubernetes

Dentro da pasta `back`, com um cluster Kubernetes ativo:

```bash
docker compose build
./kubernetes/up.sh up
```

Também existem `./kubernetes/up.sh status` (mostra os pods) e `./kubernetes/up.sh down` (remove tudo). Os serviços ficam expostos nas portas 30001 a 30006.

> **Kubernetes do Docker Desktop: use o modo kubeadm.** Em Settings → Kubernetes → *Choose cluster provisioning method*, escolha **kubeadm**. No modo **kind**, o cluster guarda uma cópia própria das imagens e não enxerga as que o `docker compose build` acabou de gerar (os pods rodam código antigo), e as portas 30001 a 30006 não ficam acessíveis no `localhost`.
>
> Depois de reconstruir as imagens com o cluster já no ar, rode `kubectl rollout restart deployment -n valuation` para os pods passarem a usar as imagens novas.

### Dados de exemplo

Com o back-end rodando, dentro da pasta `back`:

```bash
./scripts/dados-exemplo.sh          # Docker Compose
./scripts/dados-exemplo.sh 30000    # Kubernetes
```

Cadastra Petrobras, Vale, WEG e Magazine Luiza com dados de mercado e premissas aproximados (valores em milhões), prontos para ver no app. Os dados ficam em memória: se os serviços reiniciarem, rode o script de novo.

### App mobile (Flutter)

Dentro da pasta `front_mobile`, com o back-end rodando:

| Onde rodar | Comando |
|---|---|
| Emulador Android | `flutter run` |
| Navegador | `flutter run -d chrome` |
| Celular de verdade (mesma rede Wi-Fi) | `flutter run --dart-define=API_HOST=<IP do computador>` |
| Back-end no Kubernetes | acrescente `--dart-define=API_PORTA_BASE=30000` |

### Front-end web (React, parte 1)

Dentro da pasta `front`, com o back-end rodando no Docker Compose:

```bash
npm install
npm run dev
```

## Testes

| O quê | Onde | Comando |
|---|---|---|
| App mobile | `front_mobile` | `flutter test` |
| Microsserviço em Dart | `back/gestao-empresas-dart` | `dart test` |
| Independência dos microsserviços | `back` | `./scripts/teste-independencia.sh` (Docker) ou `./scripts/teste-independencia.sh k8s` |

O teste de independência desliga um microsserviço por vez (inclusive o barramento) e testa as funcionalidades de todos os outros: precisam passar os 25 testes. No final, ele cadastra de novo os dados de exemplo.

## Roteiro da apresentação

1. **Abrir o Docker Desktop** e esperar o Docker e o Kubernetes ficarem verdes (*running*).
2. **Subir o back-end** (pasta `back`, no Git Bash):
   ```bash
   cp .env.example .env
   ./scripts/up.sh --rebuild
   ./scripts/dados-exemplo.sh
   ```
3. **Abrir o app** num emulador Android (pasta `front_mobile`): `flutter run`. A primeira compilação demora alguns minutos; vale fazer antes da apresentação.
4. **Mostrar as abas**, por exemplo com a Petrobras:
   - **Empresas**: lista e cadastro de empresa.
   - **Mercado** e **Premissas**: os dados de cada empresa (as taxas são digitadas em %).
   - **Valuation**: preço justo, potencial, taxas e fluxo de caixa projetado.
   - **Cenários**: tabelas de preço justo variando WACC, crescimento e margem. A Vale e a WEG usam múltiplo de saída; a Petrobras e a Magazine Luiza usam Gordon.
5. **Mostrar que um microsserviço não depende do outro**: `./scripts/teste-independencia.sh`. Para mostrar no app: `docker compose stop dados-mercado`, calcular o valuation e abrir os cenários (continuam funcionando), e depois `docker compose start dados-mercado`.
6. **Mostrar o Kubernetes**:
   ```bash
   docker compose build
   ./kubernetes/up.sh up
   ./scripts/dados-exemplo.sh 30000
   ./kubernetes/up.sh status
   ```
   O app pode usar o Kubernetes com `flutter run --dart-define=API_PORTA_BASE=30000`.

## Problemas comuns

| Problema | Solução |
|---|---|
| O app mostra "Não foi possível conectar..." | O back-end está rodando? Confira com `docker compose ps` (Docker) ou `./kubernetes/up.sh status` (Kubernetes). |
| As empresas sumiram | Os dados ficam em memória e somem quando um serviço reinicia. Rode `./scripts/dados-exemplo.sh` de novo. |
| No Kubernetes, os pods rodam código antigo ou as portas 30001 a 30006 não respondem | O Kubernetes do Docker Desktop precisa estar em **kubeadm** (veja acima). Depois de reconstruir as imagens: `kubectl rollout restart deployment -n valuation`. |
| "Cadastre os dados de mercado desta empresa antes de salvar premissas", logo depois de cadastrá-los | Os dados chegam ao serviço de premissas por um evento, em menos de um segundo. Espere um instante e salve de novo. |
| O Flutter dá erro *"Unable to delete directory ... build"* | Acontece com o projeto dentro do OneDrive. Apague a pasta `front_mobile/build` e rode de novo. |
| O Flutter pede o NDK ou reclama do Android | No Android Studio, em SDK Manager → SDK Tools, instale o *NDK (Side by side)* e o *Android SDK Command-line Tools*. |
| `./scripts/...sh: Permission denied` (Linux/macOS) | `chmod +x scripts/*.sh kubernetes/*.sh` |

## Entregas (tags no GitHub)

| Tag | Entrega |
|---|---|
| `entrega-docker` | Scripts Docker |
| `entrega-kubernetes-parte-2` | Scripts Kubernetes |
| `entrega-front-mobile-parte-1` | App Flutter inicial |
| `entrega-back-final` | Microsserviço em Dart e scripts Docker/Kubernetes finais |
| `entrega-front-mobile-final` | App Flutter completo, integrado ao back-end |

Depois das tags, a branch `projetoParte2` recebeu correções: microsserviços totalmente independentes (comunicação só por eventos), recálculo automático do WACC, dados de exemplo e o teste de independência.

## Integrantes

| RA | Nome |
|---|---|
| 23.00209-3 | Enzo Medeiros Grando |
| 23.00438-0 | Gustavo Henrique Lamberti Widonsck |
| 23.00531-9 | Gustavo Henrique Rivero Pasqualin |
| 23.01078-9 | João Victor Pessoa de Lima dos Anjos |
| 23.00161-5 | Pedro Kuba Bloise |
