import 'package:flutter/material.dart';

import '../modelos/empresa.dart';
import '../servicos/decision_api.dart';
import '../util/numeros.dart';
import '../widgets/campo_numero.dart';
import '../widgets/estados.dart';
import '../widgets/lista_empresas_status.dart';

/// Lista as empresas e abre o formulário de premissas de projeção.
class PremissasTela extends StatelessWidget {
  const PremissasTela({super.key, required this.api});

  final DecisionApi api;

  Future<EmpresasComDados> _carregar() async {
    final (empresas, dados) = await (
      api.listarEmpresas(),
      api.listarPremissas(),
    ).wait;
    return (empresas: empresas, dados: dados);
  }

  @override
  Widget build(BuildContext context) {
    return ListaEmpresasStatus(
      titulo: 'Premissas de projeção',
      carregar: _carregar,
      textoSemDados: 'Sem premissas — toque para cadastrar',
      resumo: (p) =>
          'WACC ${formatarTaxa(p['discountRate'] as num)} · '
          '${p['projectionYears']} anos · '
          '${p['terminalValueMethod'] == 'GORDON' ? 'Gordon' : 'Múltiplo de saída'}',
      aoAbrir: (empresa, dados) => Navigator.push<bool>(
        context,
        MaterialPageRoute(
          builder: (_) => FormularioPremissas(
            api: api,
            empresa: empresa,
            existentes: dados,
          ),
        ),
      ),
    );
  }
}

/// Lê "5; 4,5; 3" como [0.05, 0.045, 0.03]. Devolve null se algum valor
/// não for número.
List<double>? lerCrescimentos(String texto) {
  final partes = texto
      .split(RegExp(r'[;\n]'))
      .map((p) => p.trim())
      .where((p) => p.isNotEmpty)
      .toList();
  final valores = <double>[];
  for (final parte in partes) {
    final valor = lerNumero(parte);
    if (valor == null) return null;
    valores.add(valor / 100);
  }
  return valores;
}

/// Formulário para cadastrar ou editar as premissas de uma empresa.
/// Devolve `true` ao fechar se algo foi salvo ou removido.
class FormularioPremissas extends StatefulWidget {
  const FormularioPremissas({
    super.key,
    required this.api,
    required this.empresa,
    this.existentes,
  });

  final DecisionApi api;
  final Empresa empresa;
  final Map<String, dynamic>? existentes;

  @override
  State<FormularioPremissas> createState() => _FormularioPremissasState();
}

class _FormularioPremissasState extends State<FormularioPremissas> {
  final _form = GlobalKey<FormState>();
  late final TextEditingController _crescimentos;
  late final TextEditingController _margemEbitda;
  late final TextEditingController _capex;
  late final TextEditingController _capitalGiro;
  late final TextEditingController _crescimentoPerpetuo;
  late final TextEditingController _multiploSaida;
  late final TextEditingController _taxaLivreRisco;
  late final TextEditingController _premioRisco;
  late String _metodo;
  bool _salvando = false;

  bool get _existe => widget.existentes != null;

  @override
  void initState() {
    super.initState();
    final p = widget.existentes ?? const <String, dynamic>{};

    TextEditingController taxa(String chave) => TextEditingController(
      text: p[chave] is num ? taxaParaCampo(p[chave] as num) : '',
    );

    final crescimentos = (p['revenueGrowthByYear'] as List?)?.cast<num>();
    _crescimentos = TextEditingController(
      text: crescimentos?.map(taxaParaCampo).join('; ') ?? '',
    );
    _margemEbitda = taxa('projectedEbitdaMargin');
    _capex = taxa('capexPercentOfRevenue');
    _capitalGiro = taxa('workingCapitalChangePercentOfRevenue');
    _crescimentoPerpetuo = taxa('perpetualGrowthRate');
    _taxaLivreRisco = taxa('riskFreeRate');
    _premioRisco = taxa('marketRiskPremium');
    _multiploSaida = TextEditingController(
      text: p['exitMultiple'] is num
          ? numeroParaCampo(p['exitMultiple'] as num)
          : '',
    );
    _metodo = p['terminalValueMethod'] as String? ?? 'GORDON';
  }

  @override
  void dispose() {
    for (final c in [
      _crescimentos,
      _margemEbitda,
      _capex,
      _capitalGiro,
      _crescimentoPerpetuo,
      _multiploSaida,
      _taxaLivreRisco,
      _premioRisco,
    ]) {
      c.dispose();
    }
    super.dispose();
  }

  String? _validarCrescimentos(String? texto) {
    final valores = lerCrescimentos(texto ?? '');
    if (valores == null) return 'Use números separados por ";" (ex.: 5; 4; 3)';
    if (valores.isEmpty) return 'Informe pelo menos um ano';
    if (valores.length > 20) return 'No máximo 20 anos de projeção';
    if (valores.any((v) => v <= -1)) {
      return 'Cada crescimento deve ser maior que -100%';
    }
    return null;
  }

  Future<void> _salvar() async {
    if (!_form.currentState!.validate()) {
      mostrarAviso(context, 'Confira os campos destacados.', erro: true);
      return;
    }
    double? taxa(TextEditingController c) =>
        CampoNumero.lerValor(c, porcentagem: true);

    final crescimentos = lerCrescimentos(_crescimentos.text)!;
    final premissas = <String, Object?>{
      'projectionYears': crescimentos.length,
      'revenueGrowthByYear': crescimentos,
      'projectedEbitdaMargin': taxa(_margemEbitda),
      'capexPercentOfRevenue': taxa(_capex),
      'workingCapitalChangePercentOfRevenue': taxa(_capitalGiro),
      'perpetualGrowthRate': taxa(_crescimentoPerpetuo),
      'terminalValueMethod': _metodo,
      if (_metodo == 'EXIT_MULTIPLE')
        'exitMultiple': CampoNumero.lerValor(_multiploSaida),
      // Opcionais: se ficarem vazios, o back-end usa os valores padrão.
      if (taxa(_taxaLivreRisco) != null) 'riskFreeRate': taxa(_taxaLivreRisco),
      if (taxa(_premioRisco) != null) 'marketRiskPremium': taxa(_premioRisco),
    };

    setState(() => _salvando = true);
    try {
      final salvas = await widget.api.salvarPremissas(
        widget.empresa.id,
        premissas,
        existe: _existe,
      );
      if (!mounted) return;
      mostrarAviso(
        context,
        'Premissas salvas. WACC calculado: '
        '${formatarTaxa(salvas['discountRate'] as num)}.',
      );
      Navigator.pop(context, true);
    } on Exception catch (e) {
      if (!mounted) return;
      setState(() => _salvando = false);
      mostrarAviso(context, '$e', erro: true);
    }
  }

  Future<void> _remover() async {
    final ok = await confirmar(
      context,
      titulo: 'Remover premissas?',
      mensagem: 'As premissas de ${widget.empresa.nome} serão apagadas.',
    );
    if (!ok || !mounted) return;
    try {
      await widget.api.removerPremissas(widget.empresa.id);
      if (!mounted) return;
      mostrarAviso(context, 'Premissas removidas.');
      Navigator.pop(context, true);
    } on Exception catch (e) {
      if (mounted) mostrarAviso(context, '$e', erro: true);
    }
  }

  @override
  Widget build(BuildContext context) {
    final tema = Theme.of(context);
    const espaco = SizedBox(height: 12);
    final wacc = widget.existentes?['discountRate'];

    return Scaffold(
      appBar: AppBar(
        title: Text(widget.empresa.ticker),
        actions: [
          if (_existe)
            IconButton(
              tooltip: 'Remover premissas',
              onPressed: _salvando ? null : _remover,
              icon: const Icon(Icons.delete_outline),
            ),
        ],
      ),
      body: Form(
        key: _form,
        // SingleChildScrollView + Column (e nao ListView): assim todos os
        // campos ficam montados e o validate() confere todos eles.
        child: SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 32),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(
                'Premissas de projeção de ${widget.empresa.nome}. '
                'A taxa de desconto (WACC) é calculada automaticamente a partir '
                'dos dados de mercado.',
                style: tema.textTheme.bodyMedium,
              ),
              if (wacc is num) ...[
                espaco,
                Card(
                  color: tema.colorScheme.secondaryContainer,
                  child: ListTile(
                    leading: const Icon(Icons.percent),
                    title: Text('WACC atual: ${formatarTaxa(wacc)}'),
                    subtitle: const Text('Recalculado sempre que você salva'),
                  ),
                ),
              ],
              const SizedBox(height: 20),
              Text('Crescimento e margens', style: tema.textTheme.titleMedium),
              espaco,
              TextFormField(
                controller: _crescimentos,
                decoration: const InputDecoration(
                  labelText: 'Crescimento da receita por ano',
                  hintText: 'Ex.: 10; 8; 7; 5; 3',
                  helperText:
                      'Um valor em % para cada ano, separados por ";". '
                      'A quantidade de valores define os anos de projeção.',
                  helperMaxLines: 3,
                  suffixText: '%',
                ),
                keyboardType: TextInputType.text,
                validator: _validarCrescimentos,
              ),
              espaco,
              CampoNumero(
                controller: _margemEbitda,
                rotulo: 'Margem EBITDA projetada',
                dica: 'Ex.: 25',
                porcentagem: true,
                minimo: 0,
                maximo: 100,
              ),
              espaco,
              CampoNumero(
                controller: _capex,
                rotulo: 'Capex (% da receita)',
                dica: 'Ex.: 8',
                porcentagem: true,
                minimo: 0,
                maximo: 100,
              ),
              espaco,
              CampoNumero(
                controller: _capitalGiro,
                rotulo: 'Variação do capital de giro (% da receita)',
                dica: 'Ex.: 1',
                porcentagem: true,
                minimo: -100,
                maximo: 100,
                minimoExclusivo: true,
                maximoExclusivo: true,
              ),
              const SizedBox(height: 20),
              Text('Valor terminal', style: tema.textTheme.titleMedium),
              espaco,
              SegmentedButton<String>(
                segments: const [
                  ButtonSegment(value: 'GORDON', label: Text('Gordon')),
                  ButtonSegment(
                    value: 'EXIT_MULTIPLE',
                    label: Text('Múltiplo de saída'),
                  ),
                ],
                selected: {_metodo},
                onSelectionChanged: (s) => setState(() => _metodo = s.first),
              ),
              espaco,
              CampoNumero(
                controller: _crescimentoPerpetuo,
                rotulo: 'Crescimento na perpetuidade',
                dica: 'Ex.: 3',
                ajuda: 'Precisa ser menor que o WACC',
                porcentagem: true,
                minimo: 0,
              ),
              if (_metodo == 'EXIT_MULTIPLE') ...[
                espaco,
                CampoNumero(
                  controller: _multiploSaida,
                  rotulo: 'Múltiplo de saída (EV/EBITDA)',
                  dica: 'Ex.: 6',
                  sufixo: 'x',
                  minimo: 0,
                  minimoExclusivo: true,
                ),
              ],
              const SizedBox(height: 12),
              ExpansionTile(
                tilePadding: EdgeInsets.zero,
                title: const Text('Taxas do CAPM (opcional)'),
                subtitle: const Text('Vazio = padrão do sistema (4,5% e 5,5%)'),
                childrenPadding: const EdgeInsets.only(bottom: 8),
                children: [
                  CampoNumero(
                    controller: _taxaLivreRisco,
                    rotulo: 'Taxa livre de risco',
                    dica: '4,5',
                    porcentagem: true,
                    obrigatorio: false,
                    minimo: 0,
                    maximo: 100,
                    maximoExclusivo: true,
                  ),
                  espaco,
                  CampoNumero(
                    controller: _premioRisco,
                    rotulo: 'Prêmio de risco de mercado',
                    dica: '5,5',
                    porcentagem: true,
                    obrigatorio: false,
                    minimo: 0,
                    maximo: 100,
                    maximoExclusivo: true,
                  ),
                ],
              ),
              const SizedBox(height: 24),
              FilledButton.icon(
                onPressed: _salvando ? null : _salvar,
                icon: const Icon(Icons.save_outlined),
                label: Text(_salvando ? 'Salvando...' : 'Salvar'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
