import 'package:intl/intl.dart';

/// Lê um número digitado no formato brasileiro ou americano.
///
/// Aceita `150,50`, `150.50`, `1.234,56`, `1.000.000`, `13.000` e `9%`.
/// Um único ponto seguido de exatamente 3 dígitos (`13.000`) é lido como
/// separador de milhar, como no Brasil; `38.50` continua sendo 38,5.
/// Devolve `null` se o texto não for um número.
double? lerNumero(String texto) {
  var limpo = texto.replaceAll(RegExp(r'[\s%R$x]'), '');
  if (limpo.isEmpty) return null;

  final temPonto = limpo.contains('.');
  final temVirgula = limpo.contains(',');
  if (temPonto && temVirgula) {
    // 1.234,56 -> pontos são separadores de milhar.
    limpo = limpo.replaceAll('.', '').replaceAll(',', '.');
  } else if (temVirgula) {
    limpo = limpo.replaceAll(',', '.');
  } else if ('.'.allMatches(limpo).length > 1 ||
      RegExp(r'^-?[1-9]\d{0,2}\.\d{3}$').hasMatch(limpo)) {
    // 1.000.000 e 13.000 -> pontos de milhar.
    limpo = limpo.replaceAll('.', '');
  }
  return double.tryParse(limpo);
}

/// Texto para preencher um campo com um número já salvo (ex.: 38.5 -> "38,5").
String numeroParaCampo(num valor) {
  final arredondado = double.parse(valor.toStringAsFixed(6));
  if (arredondado == arredondado.roundToDouble()) {
    return arredondado.toInt().toString();
  }
  return arredondado.toString().replaceAll('.', ',');
}

/// Taxa decimal para o campo em porcentagem (ex.: 0.09 -> "9").
String taxaParaCampo(num taxa) => numeroParaCampo(taxa * 100);

final _moeda = NumberFormat.currency(locale: 'pt_BR', symbol: r'R$');
final _compacto = NumberFormat.compactCurrency(locale: 'pt_BR', symbol: r'R$');
final _decimal = NumberFormat.decimalPatternDigits(
  locale: 'pt_BR',
  decimalDigits: 2,
);

/// R$ 1.234,56
String formatarMoeda(num valor) => _moeda.format(valor);

/// R$ 1,5 mi — para valores grandes como receita e dívida.
String formatarMoedaCompacta(num valor) => _compacto.format(valor);

/// 9,00%
String formatarTaxa(num taxa) => '${_decimal.format(taxa * 100)}%';

/// 1,25
String formatarDecimal(num valor) => _decimal.format(valor);
