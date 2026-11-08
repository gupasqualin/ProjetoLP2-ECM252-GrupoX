import 'package:flutter/material.dart';

/// Indicador de carregamento centralizado.
class Carregando extends StatelessWidget {
  const Carregando({super.key});

  @override
  Widget build(BuildContext context) =>
      const Center(child: CircularProgressIndicator());
}

/// Mensagem de erro com botão para tentar de novo.
class MensagemErro extends StatelessWidget {
  const MensagemErro({super.key, required this.mensagem, this.aoTentarDeNovo});

  final String mensagem;
  final VoidCallback? aoTentarDeNovo;

  @override
  Widget build(BuildContext context) {
    final cores = Theme.of(context).colorScheme;
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.cloud_off, size: 48, color: cores.error),
            const SizedBox(height: 12),
            Text(mensagem, textAlign: TextAlign.center),
            if (aoTentarDeNovo != null) ...[
              const SizedBox(height: 16),
              FilledButton.tonalIcon(
                onPressed: aoTentarDeNovo,
                icon: const Icon(Icons.refresh),
                label: const Text('Tentar de novo'),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

/// Aviso para listas vazias.
class ListaVazia extends StatelessWidget {
  const ListaVazia({
    super.key,
    required this.icone,
    required this.titulo,
    required this.descricao,
  });

  final IconData icone;
  final String titulo;
  final String descricao;

  @override
  Widget build(BuildContext context) {
    final tema = Theme.of(context);
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icone, size: 56, color: tema.colorScheme.outline),
            const SizedBox(height: 12),
            Text(titulo, style: tema.textTheme.titleMedium),
            const SizedBox(height: 4),
            Text(
              descricao,
              textAlign: TextAlign.center,
              style: tema.textTheme.bodyMedium?.copyWith(
                color: tema.colorScheme.onSurfaceVariant,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Mostra uma mensagem rápida no rodapé da tela.
void mostrarAviso(BuildContext context, String mensagem, {bool erro = false}) {
  final cores = Theme.of(context).colorScheme;
  ScaffoldMessenger.of(context)
    ..hideCurrentSnackBar()
    ..showSnackBar(
      SnackBar(
        content: Text(mensagem),
        backgroundColor: erro ? cores.error : null,
      ),
    );
}

/// Pede confirmação antes de uma ação destrutiva.
Future<bool> confirmar(
  BuildContext context, {
  required String titulo,
  required String mensagem,
  String acao = 'Remover',
}) async {
  final resposta = await showDialog<bool>(
    context: context,
    builder: (context) => AlertDialog(
      title: Text(titulo),
      content: Text(mensagem),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(context, false),
          child: const Text('Cancelar'),
        ),
        FilledButton(
          onPressed: () => Navigator.pop(context, true),
          child: Text(acao),
        ),
      ],
    ),
  );
  return resposta ?? false;
}
