import 'dart:convert';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:front_mobile/modelos/empresa.dart';
import 'package:front_mobile/servicos/api_cliente.dart';
import 'package:front_mobile/servicos/decision_api.dart';
import 'package:front_mobile/telas/sensibilidade_tela.dart';
import 'package:front_mobile/telas/valuation_tela.dart';
import 'package:front_mobile/util/numeros.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';

/// Respostas reais do back-end, salvas em test/dados/.
String _dado(String arquivo) => File('test/dados/$arquivo').readAsStringSync();

const _petrobras = Empresa(
  id: 1,
  nome: 'Petrobras',
  ticker: 'PETR4',
  setor: 'Energia',
);

DecisionApi _api(http.Response Function(http.Request) responder) => DecisionApi(
  cliente: ApiCliente(
    cliente: MockClient((requisicao) async => responder(requisicao)),
  ),
);

http.Response _json(String corpo, [int status = 200]) =>
    http.Response.bytes(utf8.encode(corpo), status);

Future<void> _mostrar(WidgetTester tester, Widget tela) async {
  tester.view.physicalSize = const Size(800, 2400);
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.reset);
  await tester.pumpWidget(MaterialApp(home: tela));
  await tester.pumpAndSettle();
}

void main() {
  testWidgets('valuation: calcula e mostra o preço justo', (tester) async {
    final requisicoes = <String>[];
    final api = _api((r) {
      requisicoes.add('${r.method} ${r.url.path}');
      return _json(_dado('valuation_sync.json'));
    });

    await _mostrar(tester, DetalheValuation(api: api, empresa: _petrobras));
    expect(find.text('Valuation ainda não calculado'), findsOneWidget);

    await tester.tap(find.text('Calcular valuation'));
    await tester.pumpAndSettle();

    expect(requisicoes, ['POST /valuation/1/sync-from-services']);
    expect(find.text(formatarMoeda(117.76)), findsOneWidget);
    expect(find.text('Preço atual ${formatarMoeda(38.5)}'), findsOneWidget);
    expect(find.text('+205,86% de potencial'), findsOneWidget);
    expect(find.text('8,82%'), findsOneWidget); // WACC
    expect(find.text('Fluxo de caixa projetado'), findsOneWidget);
  });

  testWidgets('telas de resultado cabem na tela de um celular', (tester) async {
    tester.view.physicalSize = const Size(375, 812);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);

    final valuation =
        (jsonDecode(_dado('valuation_sync.json'))
                as Map<String, dynamic>)['valuation']
            as Map<String, dynamic>;
    final api = _api((_) => _json(_dado('sensibilidade.json')));

    for (final tela in [
      DetalheValuation(api: api, empresa: _petrobras, inicial: valuation),
      DetalheSensibilidade(api: api, empresa: _petrobras),
    ]) {
      await tester.pumpWidget(MaterialApp(home: tela));
      await tester.pumpAndSettle();
      expect(tester.takeException(), isNull, reason: '$tela');
    }
  });

  testWidgets('valuation: mostra o erro do back-end', (tester) async {
    final api = _api(
      (_) => _json(
        jsonEncode({'message': 'Premissas nao encontradas para esta empresa.'}),
        422,
      ),
    );

    await _mostrar(tester, DetalheValuation(api: api, empresa: _petrobras));
    await tester.tap(find.text('Calcular valuation'));
    await tester.pumpAndSettle();

    expect(
      find.text('Premissas nao encontradas para esta empresa.'),
      findsOneWidget,
    );
  });

  testWidgets('sensibilidade: mostra as três matrizes de cenários', (
    tester,
  ) async {
    final api = _api((r) {
      expect('${r.method} ${r.url.path}', 'POST /sensitivity/1/matrices');
      return _json(_dado('sensibilidade.json'));
    });

    await _mostrar(tester, DetalheSensibilidade(api: api, empresa: _petrobras));

    // Centro da matriz WACC x Crescimento = cenário base.
    expect(find.text(formatarMoeda(117.76)), findsWidgets);
    expect(find.text(formatarMoeda(257.45)), findsOneWidget);
    expect(
      find.text('Linhas: WACC · Colunas: Crescimento perpétuo'),
      findsOneWidget,
    );

    await tester.tap(find.text('Crescimento × Margem'));
    await tester.pumpAndSettle();
    expect(
      find.text('Linhas: Crescimento perpétuo · Colunas: Margem EBITDA'),
      findsOneWidget,
    );
  });
}
