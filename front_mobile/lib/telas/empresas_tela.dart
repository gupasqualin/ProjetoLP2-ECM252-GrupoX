import 'package:flutter/material.dart';

import '../modelos/empresa.dart';
import '../servicos/decision_api.dart';
import '../widgets/estados.dart';

/// Lista, cadastra e remove empresas; também pede o recálculo do valuation.
class EmpresasTela extends StatefulWidget {
  const EmpresasTela({super.key, required this.api});

  final DecisionApi api;

  @override
  State<EmpresasTela> createState() => _EmpresasTelaState();
}

class _EmpresasTelaState extends State<EmpresasTela> {
  late Future<List<Empresa>> _empresas;

  @override
  void initState() {
    super.initState();
    _empresas = widget.api.listarEmpresas();
  }

  Future<void> _recarregar() async {
    final nova = widget.api.listarEmpresas();
    // Chaves (e não "=>"): o setState não pode receber uma função que
    // devolve Future, senão ele lança erro e a tela não é redesenhada.
    setState(() {
      _empresas = nova;
    });
    await nova.catchError((_) => <Empresa>[]);
  }

  Future<void> _abrirCadastro() async {
    final criada = await showModalBottomSheet<Empresa>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (_) => _FormularioEmpresa(api: widget.api),
    );
    if (criada == null || !mounted) return;
    mostrarAviso(context, '${criada.nome} cadastrada.');
    await _recarregar();
  }

  Future<void> _remover(Empresa empresa) async {
    final ok = await confirmar(
      context,
      titulo: 'Remover ${empresa.ticker}?',
      mensagem: 'A empresa ${empresa.nome} será removida da plataforma.',
    );
    if (!ok || !mounted) return;
    try {
      await widget.api.removerEmpresa(empresa.id);
      if (!mounted) return;
      mostrarAviso(context, '${empresa.nome} removida.');
      await _recarregar();
    } on Exception catch (e) {
      if (mounted) mostrarAviso(context, '$e', erro: true);
    }
  }

  Future<void> _recalcular(Empresa empresa) async {
    try {
      await widget.api.solicitarRecalculo(empresa.id);
      if (mounted) {
        mostrarAviso(
          context,
          'Recálculo do valuation de ${empresa.ticker} solicitado.',
        );
      }
    } on Exception catch (e) {
      if (mounted) mostrarAviso(context, '$e', erro: true);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Empresas')),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _abrirCadastro,
        icon: const Icon(Icons.add_business),
        label: const Text('Nova empresa'),
      ),
      body: FutureBuilder<List<Empresa>>(
        future: _empresas,
        builder: (context, snapshot) {
          if (snapshot.connectionState != ConnectionState.done) {
            return const Carregando();
          }
          if (snapshot.hasError) {
            return MensagemErro(
              mensagem: '${snapshot.error}',
              aoTentarDeNovo: _recarregar,
            );
          }
          final empresas = snapshot.data!;
          return RefreshIndicator(
            onRefresh: _recarregar,
            child: empresas.isEmpty
                ? ListView(
                    children: const [
                      SizedBox(height: 120),
                      ListaVazia(
                        icone: Icons.business_outlined,
                        titulo: 'Nenhuma empresa cadastrada',
                        descricao:
                            'Toque em "Nova empresa" para começar sua análise.',
                      ),
                    ],
                  )
                : ListView.separated(
                    padding: const EdgeInsets.fromLTRB(12, 8, 12, 96),
                    itemCount: empresas.length,
                    separatorBuilder: (_, _) => const SizedBox(height: 8),
                    itemBuilder: (context, i) => _CartaoEmpresa(
                      empresa: empresas[i],
                      aoRemover: () => _remover(empresas[i]),
                      aoRecalcular: () => _recalcular(empresas[i]),
                    ),
                  ),
          );
        },
      ),
    );
  }
}

class _CartaoEmpresa extends StatelessWidget {
  const _CartaoEmpresa({
    required this.empresa,
    required this.aoRemover,
    required this.aoRecalcular,
  });

  final Empresa empresa;
  final VoidCallback aoRemover;
  final VoidCallback aoRecalcular;

  @override
  Widget build(BuildContext context) {
    final cores = Theme.of(context).colorScheme;
    return Card(
      child: ListTile(
        leading: CircleAvatar(
          backgroundColor: cores.primaryContainer,
          foregroundColor: cores.onPrimaryContainer,
          child: Text(empresa.ticker.characters.take(2).toString()),
        ),
        title: Text(empresa.nome),
        subtitle: Text('${empresa.ticker} · ${empresa.setor}'),
        trailing: PopupMenuButton<String>(
          tooltip: 'Ações',
          onSelected: (acao) =>
              acao == 'recalcular' ? aoRecalcular() : aoRemover(),
          itemBuilder: (_) => const [
            PopupMenuItem(
              value: 'recalcular',
              child: ListTile(
                leading: Icon(Icons.calculate_outlined),
                title: Text('Recalcular valuation'),
              ),
            ),
            PopupMenuItem(
              value: 'remover',
              child: ListTile(
                leading: Icon(Icons.delete_outline),
                title: Text('Remover'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _FormularioEmpresa extends StatefulWidget {
  const _FormularioEmpresa({required this.api});

  final DecisionApi api;

  @override
  State<_FormularioEmpresa> createState() => _FormularioEmpresaState();
}

class _FormularioEmpresaState extends State<_FormularioEmpresa> {
  final _form = GlobalKey<FormState>();
  final _nome = TextEditingController();
  final _ticker = TextEditingController();
  final _setor = TextEditingController();
  bool _salvando = false;
  String? _erro;

  @override
  void dispose() {
    _nome.dispose();
    _ticker.dispose();
    _setor.dispose();
    super.dispose();
  }

  Future<void> _salvar() async {
    if (!_form.currentState!.validate()) return;
    setState(() {
      _salvando = true;
      _erro = null;
    });
    try {
      final empresa = await widget.api.cadastrarEmpresa(
        nome: _nome.text.trim(),
        ticker: _ticker.text.trim(),
        setor: _setor.text.trim(),
      );
      if (mounted) Navigator.pop(context, empresa);
    } on Exception catch (e) {
      setState(() {
        _salvando = false;
        _erro = '$e';
      });
    }
  }

  String? _obrigatorio(String? valor) =>
      (valor == null || valor.trim().isEmpty) ? 'Campo obrigatório' : null;

  @override
  Widget build(BuildContext context) {
    final tema = Theme.of(context);
    return Padding(
      padding: EdgeInsets.fromLTRB(
        20,
        0,
        20,
        20 + MediaQuery.viewInsetsOf(context).bottom,
      ),
      child: Form(
        key: _form,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text('Nova empresa', style: tema.textTheme.titleLarge),
            const SizedBox(height: 16),
            TextFormField(
              controller: _nome,
              decoration: const InputDecoration(
                labelText: 'Nome',
                hintText: 'Ex.: Petrobras',
              ),
              textCapitalization: TextCapitalization.words,
              textInputAction: TextInputAction.next,
              validator: _obrigatorio,
            ),
            const SizedBox(height: 12),
            TextFormField(
              controller: _ticker,
              decoration: const InputDecoration(
                labelText: 'Ticker',
                hintText: 'Ex.: PETR4',
                helperText: 'Código da ação na bolsa',
              ),
              textCapitalization: TextCapitalization.characters,
              textInputAction: TextInputAction.next,
              validator: _obrigatorio,
            ),
            const SizedBox(height: 12),
            TextFormField(
              controller: _setor,
              decoration: const InputDecoration(
                labelText: 'Setor',
                hintText: 'Ex.: Energia',
              ),
              textCapitalization: TextCapitalization.sentences,
              textInputAction: TextInputAction.done,
              onFieldSubmitted: (_) => _salvar(),
              validator: _obrigatorio,
            ),
            if (_erro != null) ...[
              const SizedBox(height: 12),
              Text(_erro!, style: TextStyle(color: tema.colorScheme.error)),
            ],
            const SizedBox(height: 20),
            FilledButton(
              onPressed: _salvando ? null : _salvar,
              child: _salvando
                  ? const SizedBox.square(
                      dimension: 20,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Text('Cadastrar'),
            ),
          ],
        ),
      ),
    );
  }
}
