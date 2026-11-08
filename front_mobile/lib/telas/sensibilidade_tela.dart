import 'package:flutter/material.dart';

import '../modelos/empresa.dart';
import '../servicos/decision_api.dart';
import '../util/numeros.dart';
import '../widgets/estados.dart';
import '../widgets/lista_empresas_status.dart';

/// Lista as empresas e gera a análise de sensibilidade de cada uma.
class SensibilidadeTela extends StatelessWidget {
  const SensibilidadeTela({super.key, required this.api});

  final DecisionApi api;

  Future<EmpresasComDados> _carregar() async {
    final (empresas, dados) = await (
      api.listarEmpresas(),
      api.listarValuations(),
    ).wait;
    return (empresas: empresas, dados: dados);
  }

  @override
  Widget build(BuildContext context) {
    return ListaEmpresasStatus(
      titulo: 'Sensibilidade',
      carregar: _carregar,
      textoSemDados: 'Toque para gerar os cenários',
      resumo: (v) =>
          'Cenário base ${formatarMoeda((v['valuation'] as Map)['fairValuePerShare'] as num)}'
          ' — toque para ver os cenários',
      aoAbrir: (empresa, _) => Navigator.push<bool>(
        context,
        MaterialPageRoute(
          builder: (_) => DetalheSensibilidade(api: api, empresa: empresa),
        ),
      ),
    );
  }
}

/// Uma das matrizes devolvidas pelo back-end.
class _Matriz {
  const _Matriz(this.chave, this.titulo, this.eixoLinhas, this.eixoColunas);

  final String chave;
  final String titulo;
  final String eixoLinhas;
  final String eixoColunas;
}

const _matrizes = [
  _Matriz('waccVsG', 'WACC × Crescimento', 'WACC', 'Crescimento perpétuo'),
  _Matriz('waccVsEbitdaMargin', 'WACC × Margem', 'WACC', 'Margem EBITDA'),
  _Matriz(
    'gVsEbitdaMargin',
    'Crescimento × Margem',
    'Crescimento perpétuo',
    'Margem EBITDA',
  ),
];

/// Matrizes de preço justo variando WACC, crescimento perpétuo e margem.
class DetalheSensibilidade extends StatefulWidget {
  const DetalheSensibilidade({
    super.key,
    required this.api,
    required this.empresa,
  });

  final DecisionApi api;
  final Empresa empresa;

  @override
  State<DetalheSensibilidade> createState() => _DetalheSensibilidadeState();
}

class _DetalheSensibilidadeState extends State<DetalheSensibilidade> {
  late Future<Map<String, dynamic>> _analise;
  int _matriz = 0;

  @override
  void initState() {
    super.initState();
    _analise = widget.api.gerarSensibilidade(widget.empresa.id);
  }

  void _gerarDeNovo() {
    setState(() {
      _analise = widget.api.gerarSensibilidade(widget.empresa.id);
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text('${widget.empresa.ticker} · Cenários')),
      body: FutureBuilder<Map<String, dynamic>>(
        future: _analise,
        builder: (context, snapshot) {
          if (snapshot.connectionState != ConnectionState.done) {
            return const Carregando();
          }
          if (snapshot.hasError) {
            return MensagemErro(
              mensagem: '${snapshot.error}',
              aoTentarDeNovo: _gerarDeNovo,
            );
          }
          final analise = snapshot.data!;
          final base = analise['baseFairValuePerShare'] as num;
          final matriz = _matrizes[_matriz];
          final dados =
              (analise['matrices'] as Map<String, dynamic>)[matriz.chave]
                  as Map<String, dynamic>;

          return ListView(
            padding: const EdgeInsets.all(16),
            children: [
              Text(
                'Como o preço justo muda se as premissas variarem. '
                'O cenário base é ${formatarMoeda(base)} (centro da tabela).',
              ),
              const SizedBox(height: 16),
              SingleChildScrollView(
                scrollDirection: Axis.horizontal,
                child: SegmentedButton<int>(
                  showSelectedIcon: false,
                  segments: [
                    for (var i = 0; i < _matrizes.length; i++)
                      ButtonSegment(value: i, label: Text(_matrizes[i].titulo)),
                  ],
                  selected: {_matriz},
                  onSelectionChanged: (s) => setState(() => _matriz = s.first),
                ),
              ),
              const SizedBox(height: 16),
              _TabelaCenarios(matriz: matriz, dados: dados, base: base),
              const SizedBox(height: 12),
              const _Legenda(),
            ],
          );
        },
      ),
    );
  }
}

class _TabelaCenarios extends StatelessWidget {
  const _TabelaCenarios({
    required this.matriz,
    required this.dados,
    required this.base,
  });

  final _Matriz matriz;
  final Map<String, dynamic> dados;
  final num base;

  @override
  Widget build(BuildContext context) {
    final tema = Theme.of(context);
    // rowAxis/columnAxis dizem qual campo de cada linha/célula tem o valor
    // do eixo (ex.: "discountRate").
    final campoLinha = dados['rowAxis'] as String;
    final campoColuna = dados['columnAxis'] as String;
    final linhas = (dados['rows'] as List).cast<Map<String, dynamic>>();
    final colunas = (linhas.first['cells'] as List)
        .cast<Map<String, dynamic>>();
    final meio = linhas.length ~/ 2;
    final meioColuna = colunas.length ~/ 2;

    Widget celula(String texto, {Color? fundo, bool destaque = false}) =>
        Container(
          width: 84,
          height: 40,
          alignment: Alignment.center,
          margin: const EdgeInsets.all(1),
          decoration: BoxDecoration(
            color: fundo,
            borderRadius: BorderRadius.circular(4),
            border: destaque
                ? Border.all(color: tema.colorScheme.onSurface, width: 2)
                : null,
          ),
          child: Text(
            texto,
            style: TextStyle(
              fontSize: 12,
              fontWeight: destaque ? FontWeight.bold : FontWeight.normal,
            ),
          ),
        );

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Linhas: ${matriz.eixoLinhas} · Colunas: ${matriz.eixoColunas}',
          style: tema.textTheme.labelMedium,
        ),
        const SizedBox(height: 8),
        SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          child: Column(
            children: [
              Row(
                children: [
                  celula(''),
                  for (final c in colunas)
                    celula(
                      formatarTaxa(c[campoColuna] as num),
                      fundo: tema.colorScheme.surfaceContainerHighest,
                    ),
                ],
              ),
              for (var i = 0; i < linhas.length; i++)
                Row(
                  children: [
                    celula(
                      formatarTaxa(linhas[i][campoLinha] as num),
                      fundo: tema.colorScheme.surfaceContainerHighest,
                    ),
                    for (var j = 0; j < colunas.length; j++)
                      _celulaValor(
                        context,
                        celula,
                        (linhas[i]['cells'] as List)[j] as Map<String, dynamic>,
                        destaque: i == meio && j == meioColuna,
                      ),
                  ],
                ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _celulaValor(
    BuildContext context,
    Widget Function(String, {Color? fundo, bool destaque}) celula,
    Map<String, dynamic> dadosCelula, {
    required bool destaque,
  }) {
    final valor = dadosCelula['fairValuePerShare'];
    if (valor is! num) return celula('—');
    return celula(
      formatarMoeda(valor),
      fundo: _corPara(valor),
      destaque: destaque,
    );
  }

  /// Verde quando o preço justo fica acima do cenário base, vermelho abaixo;
  /// quanto maior a diferença, mais forte a cor.
  Color _corPara(num valor) {
    if (base == 0) return Colors.transparent;
    final variacao = ((valor - base) / base).clamp(-0.5, 0.5) / 0.5;
    final cor = variacao >= 0 ? Colors.green : Colors.red;
    return cor.withValues(alpha: 0.12 + 0.45 * variacao.abs());
  }
}

class _Legenda extends StatelessWidget {
  const _Legenda();

  @override
  Widget build(BuildContext context) {
    Widget item(Color cor, String texto) => Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 14,
          height: 14,
          decoration: BoxDecoration(
            color: cor,
            borderRadius: BorderRadius.circular(3),
          ),
        ),
        const SizedBox(width: 6),
        Text(texto, style: Theme.of(context).textTheme.bodySmall),
      ],
    );

    return Wrap(
      spacing: 16,
      runSpacing: 8,
      children: [
        item(Colors.green.withValues(alpha: 0.5), 'Acima do cenário base'),
        item(Colors.red.withValues(alpha: 0.5), 'Abaixo do cenário base'),
      ],
    );
  }
}
