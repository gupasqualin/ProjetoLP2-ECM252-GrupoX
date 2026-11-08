import 'package:flutter/material.dart';

import '../util/numeros.dart';

/// Campo de texto para números, com validação de obrigatório e faixa.
///
/// Com [porcentagem] = true o usuário digita `9` para 9% e o valor
/// lido por [lerValor] já vem convertido para `0.09`.
class CampoNumero extends StatelessWidget {
  const CampoNumero({
    super.key,
    required this.controller,
    required this.rotulo,
    this.dica,
    this.ajuda,
    this.porcentagem = false,
    this.prefixo,
    this.sufixo,
    this.obrigatorio = true,
    this.minimo,
    this.maximo,
    this.minimoExclusivo = false,
    this.maximoExclusivo = false,
  });

  final TextEditingController controller;
  final String rotulo;
  final String? dica;
  final String? ajuda;
  final bool porcentagem;
  final String? prefixo;
  final String? sufixo;
  final bool obrigatorio;

  /// Limites no valor digitado (para porcentagem, em %: 0 a 100).
  final double? minimo;
  final double? maximo;
  final bool minimoExclusivo;
  final bool maximoExclusivo;

  /// Valor do campo já convertido (porcentagem vira decimal).
  static double? lerValor(
    TextEditingController controller, {
    bool porcentagem = false,
  }) {
    final valor = lerNumero(controller.text);
    if (valor == null) return null;
    return porcentagem ? valor / 100 : valor;
  }

  String? _validar(String? texto) {
    if (texto == null || texto.trim().isEmpty) {
      return obrigatorio ? 'Campo obrigatório' : null;
    }
    final valor = lerNumero(texto);
    if (valor == null) return 'Digite um número válido';

    final unidade = porcentagem ? '%' : '';
    if (minimo != null &&
        (minimoExclusivo ? valor <= minimo! : valor < minimo!)) {
      final comparacao = minimoExclusivo ? 'maior que' : 'no mínimo';
      return 'Deve ser $comparacao ${numeroParaCampo(minimo!)}$unidade';
    }
    if (maximo != null &&
        (maximoExclusivo ? valor >= maximo! : valor > maximo!)) {
      final comparacao = maximoExclusivo ? 'menor que' : 'no máximo';
      return 'Deve ser $comparacao ${numeroParaCampo(maximo!)}$unidade';
    }
    return null;
  }

  @override
  Widget build(BuildContext context) {
    return TextFormField(
      controller: controller,
      decoration: InputDecoration(
        labelText: rotulo,
        hintText: dica,
        helperText: ajuda,
        helperMaxLines: 2,
        prefixText: prefixo,
        suffixText: porcentagem ? '%' : sufixo,
      ),
      keyboardType: const TextInputType.numberWithOptions(
        decimal: true,
        signed: true,
      ),
      textInputAction: TextInputAction.next,
      validator: _validar,
    );
  }
}
