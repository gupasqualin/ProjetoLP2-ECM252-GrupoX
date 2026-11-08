import 'package:flutter/material.dart';

import '../modelos/empresa.dart';
import '../servicos/decision_api.dart';
import '../util/numeros.dart';
import '../widgets/campo_numero.dart';
import '../widgets/estados.dart';
import '../widgets/lista_empresas_status.dart';

/// Lista as empresas e abre o formulário de dados de mercado de cada uma.
class DadosMercadoTela extends StatelessWidget {
  const DadosMercadoTela({super.key, required this.api});

  final DecisionApi api;

  Future<EmpresasComDados> _carregar() async {
    final (empresas, dados) = await (
      api.listarEmpresas(),
      api.listarDadosMercado(),
    ).wait;
    return (empresas: empresas, dados: dados);
  }

  @override
  Widget build(BuildContext context) {
    return ListaEmpresasStatus(
      titulo: 'Dados de mercado',
      carregar: _carregar,
      textoSemDados: 'Sem dados de mercado — toque para cadastrar',
      resumo: (d) =>
          'Ação ${formatarMoeda(d['currentStockPrice'] as num)} · '
          'Receita ${formatarMoedaCompacta(d['revenue'] as num)}',
      aoAbrir: (empresa, dados) => Navigator.push<bool>(
        context,
        MaterialPageRoute(
          builder: (_) => FormularioDadosMercado(
            api: api,
            empresa: empresa,
            existentes: dados,
          ),
        ),
      ),
    );
  }
}

/// Um campo do formulário de dados de mercado.
class _Campo {
  const _Campo(
    this.chave,
    this.rotulo, {
    this.dica,
    this.ajuda,
    this.moeda = false,
    this.porcentagem = false,
    this.minimo,
    this.maximo,
    this.minimoExclusivo = false,
  });

  final String chave;
  final String rotulo;
  final String? dica;
  final String? ajuda;
  final bool moeda;
  final bool porcentagem;
  final double? minimo;
  final double? maximo;
  final bool minimoExclusivo;
}

/// Campos agrupados por seção, com as mesmas regras de validação do back-end.
const _secoes = <(String, List<_Campo>)>[
  (
    'Ação',
    [
      _Campo(
        'currentStockPrice',
        'Preço atual da ação',
        dica: 'Ex.: 38,50',
        moeda: true,
        minimo: 0,
        minimoExclusivo: true,
      ),
      _Campo(
        'sharesOutstanding',
        'Ações emitidas',
        dica: 'Ex.: 13000000000',
        minimo: 0,
        minimoExclusivo: true,
      ),
      _Campo(
        'beta',
        'Beta',
        dica: 'Ex.: 1,1',
        ajuda: 'Risco da ação em relação ao mercado (1 = igual ao mercado)',
        minimo: 0,
        minimoExclusivo: true,
      ),
    ],
  ),
  (
    'Dívida e impostos',
    [
      _Campo('totalDebt', 'Dívida bruta total', moeda: true, minimo: 0),
      _Campo(
        'costOfDebt',
        'Custo da dívida',
        dica: 'Ex.: 9',
        porcentagem: true,
        minimo: 0,
        maximo: 100,
      ),
      _Campo(
        'effectiveTaxRate',
        'Alíquota efetiva de IR',
        dica: 'Ex.: 34',
        porcentagem: true,
        minimo: 0,
        maximo: 100,
      ),
      _Campo('cash', 'Caixa e equivalentes', moeda: true, minimo: 0),
      _Campo('netDebt', 'Dívida líquida', moeda: true, minimo: 0),
    ],
  ),
  (
    'Resultados do último ano',
    [
      _Campo(
        'revenue',
        'Receita líquida',
        moeda: true,
        minimo: 0,
        minimoExclusivo: true,
      ),
      _Campo('ebitda', 'EBITDA', moeda: true),
      _Campo('ebit', 'EBIT', moeda: true),
      _Campo('capex', 'Capex', moeda: true, minimo: 0, minimoExclusivo: true),
      _Campo(
        'depreciation',
        'Depreciação e amortização',
        moeda: true,
        minimo: 0,
        minimoExclusivo: true,
      ),
      _Campo('workingCapital', 'Capital de giro líquido', moeda: true),
    ],
  ),
];

/// Formulário para cadastrar ou editar os dados de mercado de uma empresa.
/// Devolve `true` ao fechar se algo foi salvo ou removido.
class FormularioDadosMercado extends StatefulWidget {
  const FormularioDadosMercado({
    super.key,
    required this.api,
    required this.empresa,
    this.existentes,
  });

  final DecisionApi api;
  final Empresa empresa;
  final Map<String, dynamic>? existentes;

  @override
  State<FormularioDadosMercado> createState() => _FormularioDadosMercadoState();
}

class _FormularioDadosMercadoState extends State<FormularioDadosMercado> {
  final _form = GlobalKey<FormState>();
  late final Map<String, TextEditingController> _controles;
  bool _salvando = false;

  bool get _existe => widget.existentes != null;

  @override
  void initState() {
    super.initState();
    _controles = {
      for (final (_, campos) in _secoes)
        for (final campo in campos)
          campo.chave: TextEditingController(text: _valorInicial(campo)),
    };
  }

  String _valorInicial(_Campo campo) {
    final valor = widget.existentes?[campo.chave];
    if (valor is! num) return '';
    return campo.porcentagem ? taxaParaCampo(valor) : numeroParaCampo(valor);
  }

  @override
  void dispose() {
    for (final controle in _controles.values) {
      controle.dispose();
    }
    super.dispose();
  }

  Future<void> _salvar() async {
    if (!_form.currentState!.validate()) {
      mostrarAviso(context, 'Confira os campos destacados.', erro: true);
      return;
    }
    final dados = <String, Object>{
      for (final (_, campos) in _secoes)
        for (final campo in campos)
          campo.chave: CampoNumero.lerValor(
            _controles[campo.chave]!,
            porcentagem: campo.porcentagem,
          )!,
    };

    setState(() => _salvando = true);
    try {
      await widget.api.salvarDadosMercado(
        widget.empresa.id,
        dados,
        existe: _existe,
      );
      if (!mounted) return;
      mostrarAviso(context, 'Dados de mercado salvos.');
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
      titulo: 'Remover dados de mercado?',
      mensagem: 'Os dados de mercado de ${widget.empresa.nome} serão apagados.',
    );
    if (!ok || !mounted) return;
    try {
      await widget.api.removerDadosMercado(widget.empresa.id);
      if (!mounted) return;
      mostrarAviso(context, 'Dados de mercado removidos.');
      Navigator.pop(context, true);
    } on Exception catch (e) {
      if (mounted) mostrarAviso(context, '$e', erro: true);
    }
  }

  @override
  Widget build(BuildContext context) {
    final tema = Theme.of(context);
    return Scaffold(
      appBar: AppBar(
        title: Text(widget.empresa.ticker),
        actions: [
          if (_existe)
            IconButton(
              tooltip: 'Remover dados',
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
                _existe
                    ? 'Edite os dados de mercado de ${widget.empresa.nome}.'
                    : 'Cadastre os dados de mercado de ${widget.empresa.nome}.',
                style: tema.textTheme.bodyMedium,
              ),
              for (final (titulo, campos) in _secoes) ...[
                const SizedBox(height: 20),
                Text(titulo, style: tema.textTheme.titleMedium),
                for (final campo in campos) ...[
                  const SizedBox(height: 12),
                  CampoNumero(
                    controller: _controles[campo.chave]!,
                    rotulo: campo.rotulo,
                    dica: campo.dica,
                    ajuda: campo.ajuda,
                    prefixo: campo.moeda ? r'R$ ' : null,
                    porcentagem: campo.porcentagem,
                    minimo: campo.minimo,
                    maximo: campo.maximo,
                    minimoExclusivo: campo.minimoExclusivo,
                  ),
                ],
              ],
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
