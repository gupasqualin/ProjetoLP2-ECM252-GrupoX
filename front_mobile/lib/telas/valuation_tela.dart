import 'package:flutter/material.dart';

import '../modelos/empresa.dart';
import '../servicos/decision_api.dart';
import '../util/numeros.dart';
import '../widgets/estados.dart';
import '../widgets/lista_empresas_status.dart';

/// Lista as empresas com o preço justo calculado e abre o detalhe.
class ValuationTela extends StatelessWidget {
  const ValuationTela({super.key, required this.api});

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
      titulo: 'Valuation',
      carregar: _carregar,
      textoSemDados: 'Ainda não calculado — toque para calcular',
      resumo: (v) {
        final r = v['valuation'] as Map<String, dynamic>;
        return 'Preço justo ${formatarMoeda(r['fairValuePerShare'] as num)} · '
            '${_potencial(r['upsidePercent'] as num)}';
      },
      aoAbrir: (empresa, dados) => Navigator.push<bool>(
        context,
        MaterialPageRoute(
          builder: (_) =>
              DetalheValuation(api: api, empresa: empresa, inicial: dados),
        ),
      ),
    );
  }
}

String _potencial(num upside) =>
    '${upside >= 0 ? '+' : ''}${formatarTaxa(upside)} de potencial';

/// Resultado completo do valuation de uma empresa.
/// Devolve `true` ao fechar se o valuation foi recalculado.
class DetalheValuation extends StatefulWidget {
  const DetalheValuation({
    super.key,
    required this.api,
    required this.empresa,
    this.inicial,
  });

  final DecisionApi api;
  final Empresa empresa;
  final Map<String, dynamic>? inicial;

  @override
  State<DetalheValuation> createState() => _DetalheValuationState();
}

class _DetalheValuationState extends State<DetalheValuation> {
  Map<String, dynamic>? _valuation;
  bool _calculando = false;
  bool _recalculou = false;
  String? _erro;

  @override
  void initState() {
    super.initState();
    _valuation = widget.inicial;
  }

  Future<void> _calcular() async {
    setState(() {
      _calculando = true;
      _erro = null;
    });
    try {
      final valuation = await widget.api.calcularValuation(widget.empresa.id);
      if (!mounted) return;
      setState(() {
        _valuation = valuation;
        _recalculou = true;
      });
      mostrarAviso(context, 'Valuation calculado com os dados atuais.');
    } on Exception catch (e) {
      if (mounted) setState(() => _erro = '$e');
    } finally {
      if (mounted) setState(() => _calculando = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final valuation = _valuation;
    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop) Navigator.pop(context, _recalculou);
      },
      child: Scaffold(
        appBar: AppBar(
          title: Text(widget.empresa.ticker),
          actions: [
            if (valuation != null)
              IconButton(
                tooltip: 'Recalcular',
                onPressed: _calculando ? null : _calcular,
                icon: const Icon(Icons.refresh),
              ),
          ],
        ),
        body: _calculando
            ? const Carregando()
            : valuation == null
            ? _SemValuation(erro: _erro, aoCalcular: _calcular)
            : _Resultado(valuation: valuation, erro: _erro),
      ),
    );
  }
}

class _SemValuation extends StatelessWidget {
  const _SemValuation({required this.erro, required this.aoCalcular});

  final String? erro;
  final VoidCallback aoCalcular;

  @override
  Widget build(BuildContext context) {
    final tema = Theme.of(context);
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              Icons.calculate_outlined,
              size: 56,
              color: tema.colorScheme.primary,
            ),
            const SizedBox(height: 12),
            Text(
              'Valuation ainda não calculado',
              style: tema.textTheme.titleMedium,
            ),
            const SizedBox(height: 4),
            const Text(
              'O cálculo usa os dados de mercado e as premissas cadastradas.',
              textAlign: TextAlign.center,
            ),
            if (erro != null) ...[
              const SizedBox(height: 12),
              Text(
                erro!,
                textAlign: TextAlign.center,
                style: TextStyle(color: tema.colorScheme.error),
              ),
            ],
            const SizedBox(height: 20),
            FilledButton.icon(
              onPressed: aoCalcular,
              icon: const Icon(Icons.play_arrow),
              label: const Text('Calcular valuation'),
            ),
          ],
        ),
      ),
    );
  }
}

class _Resultado extends StatelessWidget {
  const _Resultado({required this.valuation, required this.erro});

  final Map<String, dynamic> valuation;
  final String? erro;

  @override
  Widget build(BuildContext context) {
    final tema = Theme.of(context);
    final r = valuation['valuation'] as Map<String, dynamic>;
    final taxas = valuation['rates'] as Map<String, dynamic>;
    final terminal = valuation['terminalValue'] as Map<String, dynamic>;
    final fluxos = (valuation['projectedCashFlows'] as List)
        .cast<Map<String, dynamic>>();
    final upside = r['upsidePercent'] as num;
    final corPotencial = upside >= 0 ? Colors.green : tema.colorScheme.error;

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        if (erro != null) ...[
          Text(erro!, style: TextStyle(color: tema.colorScheme.error)),
          const SizedBox(height: 12),
        ],
        Card(
          color: tema.colorScheme.primaryContainer,
          child: Padding(
            padding: const EdgeInsets.all(20),
            child: Column(
              children: [
                Text('Preço justo por ação', style: tema.textTheme.labelLarge),
                const SizedBox(height: 4),
                Text(
                  formatarMoeda(r['fairValuePerShare'] as num),
                  style: tema.textTheme.displaySmall?.copyWith(
                    fontWeight: FontWeight.bold,
                    color: tema.colorScheme.onPrimaryContainer,
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  'Preço atual ${formatarMoeda(r['currentStockPrice'] as num)}',
                ),
                const SizedBox(height: 8),
                Chip(
                  avatar: Icon(
                    upside >= 0 ? Icons.trending_up : Icons.trending_down,
                    color: corPotencial,
                  ),
                  label: Text(_potencial(upside)),
                ),
              ],
            ),
          ),
        ),
        const SizedBox(height: 16),
        _Secao(
          titulo: 'Valor da empresa',
          linhas: [
            (
              'Fluxos de caixa descontados',
              formatarMoedaCompacta(r['discountedCashFlows'] as num),
            ),
            (
              'Valor terminal (presente)',
              formatarMoedaCompacta(
                terminal['presentValueTerminalValue'] as num,
              ),
            ),
            (
              'Enterprise value',
              formatarMoedaCompacta(r['enterpriseValue'] as num),
            ),
            ('Equity value', formatarMoedaCompacta(r['equityValue'] as num)),
            (
              'Valor de mercado atual',
              formatarMoedaCompacta(r['marketCapitalization'] as num),
            ),
          ],
        ),
        const SizedBox(height: 16),
        _Secao(
          titulo: 'Taxas',
          linhas: [
            (
              'WACC (taxa de desconto)',
              formatarTaxa(taxas['manualDiscountRate'] as num),
            ),
            (
              'Custo do capital próprio',
              formatarTaxa(taxas['costOfEquity'] as num),
            ),
            (
              'Custo da dívida após IR',
              formatarTaxa(taxas['costOfDebtAfterTax'] as num),
            ),
            (
              'Método do valor terminal',
              terminal['method'] == 'GORDON' ? 'Gordon' : 'Múltiplo de saída',
            ),
          ],
        ),
        const SizedBox(height: 16),
        Text('Fluxo de caixa projetado', style: tema.textTheme.titleMedium),
        const SizedBox(height: 8),
        Card(
          child: SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: DataTable(
              columnSpacing: 20,
              columns: const [
                DataColumn(label: Text('Ano')),
                DataColumn(label: Text('Receita'), numeric: true),
                DataColumn(label: Text('EBITDA'), numeric: true),
                DataColumn(label: Text('FCFF'), numeric: true),
                DataColumn(label: Text('Valor presente'), numeric: true),
              ],
              rows: [
                for (final f in fluxos)
                  DataRow(
                    cells: [
                      DataCell(Text('${f['year']}')),
                      DataCell(
                        Text(formatarMoedaCompacta(f['revenue'] as num)),
                      ),
                      DataCell(Text(formatarMoedaCompacta(f['ebitda'] as num))),
                      DataCell(Text(formatarMoedaCompacta(f['fcff'] as num))),
                      DataCell(
                        Text(
                          formatarMoedaCompacta(f['presentValueFcff'] as num),
                        ),
                      ),
                    ],
                  ),
              ],
            ),
          ),
        ),
      ],
    );
  }
}

class _Secao extends StatelessWidget {
  const _Secao({required this.titulo, required this.linhas});

  final String titulo;
  final List<(String, String)> linhas;

  @override
  Widget build(BuildContext context) {
    final tema = Theme.of(context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(titulo, style: tema.textTheme.titleMedium),
        const SizedBox(height: 8),
        Card(
          child: Column(
            children: [
              for (final (rotulo, valor) in linhas)
                ListTile(
                  dense: true,
                  title: Text(rotulo),
                  trailing: Text(
                    valor,
                    style: tema.textTheme.bodyLarge?.copyWith(
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
            ],
          ),
        ),
      ],
    );
  }
}
