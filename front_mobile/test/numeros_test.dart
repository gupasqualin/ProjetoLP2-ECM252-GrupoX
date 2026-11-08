import 'package:flutter_test/flutter_test.dart';
import 'package:front_mobile/telas/premissas_tela.dart';
import 'package:front_mobile/util/numeros.dart';

void main() {
  group('lerNumero', () {
    test('aceita formato brasileiro e americano', () {
      expect(lerNumero('150,50'), 150.5);
      expect(lerNumero('150.50'), 150.5);
      expect(lerNumero('1.234,56'), 1234.56);
      expect(lerNumero('1.000.000'), 1000000);
      expect(lerNumero('13.000'), 13000);
      expect(lerNumero('300.000'), 300000);
      expect(lerNumero('1.5'), 1.5);
      expect(lerNumero('0.045'), 0.045);
      expect(lerNumero(' 9 %'), 9);
      expect(lerNumero('-2,5'), -2.5);
    });

    test('devolve null para texto inválido', () {
      expect(lerNumero(''), isNull);
      expect(lerNumero('abc'), isNull);
    });
  });

  test('numeroParaCampo e taxaParaCampo preenchem os campos', () {
    expect(numeroParaCampo(38.5), '38,5');
    expect(numeroParaCampo(500000), '500000');
    expect(taxaParaCampo(0.09), '9');
    expect(taxaParaCampo(0.045), '4,5');
  });

  test('formatarTaxa mostra porcentagem em pt-BR', () {
    expect(formatarTaxa(0.0882), '8,82%');
  });

  test('lerCrescimentos converte a lista de % por ano', () {
    expect(lerCrescimentos('5; 4,5; 3'), [0.05, 0.045, 0.03]);
    expect(lerCrescimentos('10;8;'), [0.1, 0.08]);
    expect(lerCrescimentos('5; x'), isNull);
  });
}
