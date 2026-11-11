# DecisionDCF — aplicativo mobile

Aplicativo Flutter desenvolvido na segunda parte do projeto de Linguagens de Programação II e Arquitetura de Sistemas Computacionais. O app permite consultar e editar informações usadas na avaliação de empresas pelo método do Fluxo de Caixa Descontado (DCF).

O aplicativo acessa os microsserviços do back-end por HTTP. Inicie o back-end antes de usar as funcionalidades que dependem dos dados das empresas.

## Funcionalidades

- **Empresas:** cadastro, listagem e exclusão de empresas, além da solicitação de recálculo.
- **Mercado:** consulta e preenchimento dos dados financeiros das empresas.
- **Premissas:** definição das hipóteses de projeção, como taxas de crescimento e desconto.
- **Valuation:** visualização do preço justo estimado e dos fluxos de caixa projetados.
- **Cenários:** análise de sensibilidade do resultado a mudanças nas premissas.

As cinco seções estão disponíveis na navegação inferior do aplicativo.

## Pré-requisitos

- Flutter SDK instalado e configurado.
- Emulador Android, dispositivo Android ou navegador Chrome para execução.
- Back-end do DecisionDCF ativo. Consulte o [README principal](../README.md) para a configuração do Docker ou Kubernetes.

## Como executar

Abra o terminal na pasta `front_mobile` e instale as dependências:

```bash
flutter pub get
flutter run
```

Para executar no navegador:

```bash
flutter run -d chrome
```

Em um celular físico na mesma rede do computador que executa o back-end, defina o endereço IP do computador:

```bash
flutter run --dart-define=API_HOST=192.168.0.10
```

Substitua o IP de exemplo pelo endereço do seu computador.

## Configuração de acesso ao back-end

Os endereços são definidos no arquivo `lib/config/api_config.dart`.

| Ambiente | Host utilizado por padrão | Portas de serviço |
|---|---|---|
| Navegador / desktop | `localhost` | 3001 a 3005 |
| Emulador Android | `10.0.2.2` | 3001 a 3005 |
| Celular físico | Informado com `API_HOST` | 3001 a 3005 |
| Kubernetes | Conforme ambiente | 30001 a 30005 |

Para usar as portas NodePort do Kubernetes, execute:

```bash
flutter run --dart-define=API_PORTA_BASE=30000
```

As opções `API_HOST` e `API_PORTA_BASE` podem ser utilizadas juntas.

## Testes automatizados

Dentro da pasta `front_mobile`, execute:

```bash
flutter test
```

Para análise estática do código Dart/Flutter:

```bash
flutter analyze
```

A pasta `test/` contém testes de widgets, formulários, formatação numérica e resultados. Alguns testes simulam respostas HTTP para verificar o comportamento do aplicativo sem depender do servidor real.

## Organização do código

```text
lib/
  config/     Configuração de acesso aos microsserviços
  modelos/    Modelos de dados
  servicos/   Comunicação HTTP com o back-end
  telas/      Telas das funcionalidades do aplicativo
  util/       Formatação e mensagens
  widgets/    Componentes visuais reutilizáveis
test/         Testes automatizados
```

## Problemas comuns

- **Erro de conexão:** confira se o back-end foi iniciado e se o IP e as portas configurados estão corretos.
- **Emulador Android:** `localhost` aponta para o emulador, não para o computador. O app utiliza `10.0.2.2` por padrão.
- **Celular físico:** confirme que o celular e o computador estão na mesma rede e que o endereço informado é acessível.

Para detalhes sobre Docker, Kubernetes, dados de exemplo e roteiro de apresentação, consulte o [README da raiz do repositório](../README.md).
