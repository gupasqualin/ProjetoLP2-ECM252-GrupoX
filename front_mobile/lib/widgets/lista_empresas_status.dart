import 'package:flutter/material.dart';

import '../modelos/empresa.dart';
import 'estados.dart';

/// Empresas e os dados já cadastrados de cada uma (pelo id da empresa).
typedef EmpresasComDados = ({
  List<Empresa> empresas,
  Map<int, Map<String, dynamic>> dados,
});

/// Lista as empresas mostrando se cada uma já tem dados cadastrados.
///
/// Ao tocar numa empresa, [aoAbrir] abre a próxima tela (formulário ou
/// resultado); se ela devolver `true`, a lista é recarregada.
class ListaEmpresasStatus extends StatefulWidget {
  const ListaEmpresasStatus({
    super.key,
    required this.titulo,
    required this.carregar,
    required this.resumo,
    required this.textoSemDados,
    required this.aoAbrir,
    this.somenteLeitura = false,
  });

  final String titulo;

  /// true nas telas de resultado (Valuation e Cenários): mostra uma seta
  /// em vez dos ícones de editar/adicionar dos formulários.
  final bool somenteLeitura;
  final Future<EmpresasComDados> Function() carregar;

  /// Texto curto mostrado quando a empresa já tem dados.
  final String Function(Map<String, dynamic> dados) resumo;
  final String textoSemDados;
  final Future<bool?> Function(Empresa empresa, Map<String, dynamic>? dados)
  aoAbrir;

  @override
  State<ListaEmpresasStatus> createState() => _ListaEmpresasStatusState();
}

class _ListaEmpresasStatusState extends State<ListaEmpresasStatus> {
  late Future<EmpresasComDados> _futuro;

  @override
  void initState() {
    super.initState();
    _futuro = widget.carregar();
  }

  Future<void> _recarregar() async {
    final novo = widget.carregar();
    setState(() {
      _futuro = novo;
    });
    await novo.then((_) {}, onError: (_) {});
  }

  Future<void> _abrir(Empresa empresa, Map<String, dynamic>? dados) async {
    final alterou = await widget.aoAbrir(empresa, dados);
    if (alterou == true && mounted) await _recarregar();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(widget.titulo)),
      body: FutureBuilder<EmpresasComDados>(
        future: _futuro,
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
          final (:empresas, :dados) = snapshot.data!;
          if (empresas.isEmpty) {
            return const ListaVazia(
              icone: Icons.business_outlined,
              titulo: 'Nenhuma empresa cadastrada',
              descricao: 'Cadastre uma empresa na aba Empresas primeiro.',
            );
          }
          return RefreshIndicator(
            onRefresh: _recarregar,
            child: ListView.separated(
              padding: const EdgeInsets.all(12),
              itemCount: empresas.length,
              separatorBuilder: (_, _) => const SizedBox(height: 8),
              itemBuilder: (context, i) {
                final empresa = empresas[i];
                final dadosEmpresa = dados[empresa.id];
                return _ItemEmpresa(
                  empresa: empresa,
                  resumo: dadosEmpresa == null
                      ? null
                      : widget.resumo(dadosEmpresa),
                  textoSemDados: widget.textoSemDados,
                  somenteLeitura: widget.somenteLeitura,
                  aoTocar: () => _abrir(empresa, dadosEmpresa),
                );
              },
            ),
          );
        },
      ),
    );
  }
}

class _ItemEmpresa extends StatelessWidget {
  const _ItemEmpresa({
    required this.empresa,
    required this.resumo,
    required this.textoSemDados,
    required this.somenteLeitura,
    required this.aoTocar,
  });

  final Empresa empresa;
  final String? resumo;
  final String textoSemDados;
  final bool somenteLeitura;
  final VoidCallback aoTocar;

  @override
  Widget build(BuildContext context) {
    final cores = Theme.of(context).colorScheme;
    final temDados = resumo != null;
    return Card(
      child: ListTile(
        onTap: aoTocar,
        leading: Icon(
          temDados ? Icons.check_circle : Icons.pending_outlined,
          color: temDados ? cores.primary : cores.outline,
        ),
        title: Text(empresa.rotulo),
        subtitle: Text(resumo ?? textoSemDados),
        trailing: Icon(
          somenteLeitura
              ? Icons.chevron_right
              : (temDados ? Icons.edit_outlined : Icons.add),
        ),
      ),
    );
  }
}
