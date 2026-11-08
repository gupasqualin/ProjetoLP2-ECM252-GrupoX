import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:front_mobile/modelos/empresa.dart';
import 'package:front_mobile/servicos/api_cliente.dart';
import 'package:front_mobile/servicos/decision_api.dart';
import 'package:front_mobile/telas/dados_mercado_tela.dart';
import 'package:front_mobile/telas/premissas_tela.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';

const _petrobras = Empresa(
  id: 1,
  nome: 'Petrobras',
  ticker: 'PETR4',
  setor: 'Energia',
);

/// Guarda as requisições enviadas e responde com o próprio corpo enviado
/// (mais o WACC, como o back-end de premissas faz).
class _BackFalso {
  final requisicoes = <http.Request>[];

  late final api = DecisionApi(
    cliente: ApiCliente(
      cliente: MockClient((requisicao) async {
        requisicoes.add(requisicao);
        final corpo = {
          ...jsonDecode(requisicao.body) as Map<String, dynamic>,
          'discountRate': 0.0882,
        };
        return http.Response.bytes(utf8.encode(jsonEncode(corpo)), 200);
      }),
    ),
  );

  Map<String, dynamic> get ultimoCorpo =>
      jsonDecode(requisicoes.last.body) as Map<String, dynamic>;
}

/// Abre [tela] por cima de uma tela inicial, como o app faz.
Future<void> _abrir(WidgetTester tester, Widget tela) async {
  tester.view.physicalSize = const Size(800, 2400);
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.reset);

  await tester.pumpWidget(
    MaterialApp(
      home: Builder(
        builder: (context) => TextButton(
          onPressed: () =>
              Navigator.push(context, MaterialPageRoute(builder: (_) => tela)),
          child: const Text('abrir'),
        ),
      ),
    ),
  );
  await tester.tap(find.text('abrir'));
  await tester.pumpAndSettle();
}

Future<void> _preencher(WidgetTester tester, String rotulo, String texto) =>
    tester.enterText(find.widgetWithText(TextFormField, rotulo), texto);

Future<void> _salvar(WidgetTester tester) async {
  await tester.ensureVisible(find.text('Salvar'));
  await tester.tap(find.text('Salvar'));
  await tester.pumpAndSettle();
}

void main() {
  testWidgets('formulários cabem na tela de um celular', (tester) async {
    tester.view.physicalSize = const Size(375, 812);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);
    final back = _BackFalso();

    for (final tela in [
      FormularioDadosMercado(api: back.api, empresa: _petrobras),
      FormularioPremissas(api: back.api, empresa: _petrobras),
    ]) {
      await tester.pumpWidget(MaterialApp(home: tela));
      await tester.pumpAndSettle();
      expect(tester.takeException(), isNull, reason: '$tela');
    }
  });

  group('Formulário de dados de mercado', () {
    const valores = {
      'Preço atual da ação': '38,50',
      'Ações emitidas': '13.000',
      'Beta': '1,1',
      'Dívida bruta total': '300.000',
      'Custo da dívida': '9',
      'Alíquota efetiva de IR': '34',
      'Caixa e equivalentes': '60000',
      'Dívida líquida': '240000',
      'Receita líquida': '500000',
      'EBITDA': '230000',
      'EBIT': '160000',
      'Capex': '70000',
      'Depreciação e amortização': '70000',
      'Capital de giro líquido': '20000',
    };

    testWidgets('envia POST com números convertidos e taxas em decimal', (
      tester,
    ) async {
      final back = _BackFalso();
      await _abrir(
        tester,
        FormularioDadosMercado(api: back.api, empresa: _petrobras),
      );
      for (final MapEntry(:key, :value) in valores.entries) {
        await _preencher(tester, key, value);
      }
      await _salvar(tester);

      expect(back.requisicoes.single.method, 'POST');
      expect(back.requisicoes.single.url.path, '/market-data');
      expect(back.ultimoCorpo, {
        'companyId': 1,
        'currentStockPrice': 38.5,
        'sharesOutstanding': 13000,
        'beta': 1.1,
        'totalDebt': 300000,
        'costOfDebt': 0.09,
        'effectiveTaxRate': 0.34,
        'cash': 60000,
        'netDebt': 240000,
        'revenue': 500000,
        'ebitda': 230000,
        'ebit': 160000,
        'capex': 70000,
        'depreciation': 70000,
        'workingCapital': 20000,
      });
    });

    testWidgets('não envia nada se faltar um campo, mesmo fora da tela', (
      tester,
    ) async {
      final back = _BackFalso();
      await _abrir(
        tester,
        FormularioDadosMercado(api: back.api, empresa: _petrobras),
      );
      for (final MapEntry(:key, :value) in valores.entries) {
        if (key != 'Capital de giro líquido') {
          await _preencher(tester, key, value);
        }
      }
      await _salvar(tester);

      expect(back.requisicoes, isEmpty);
      expect(find.text('Campo obrigatório'), findsOneWidget);
    });

    testWidgets('edição usa PUT e vem preenchida', (tester) async {
      final back = _BackFalso();
      await _abrir(
        tester,
        FormularioDadosMercado(
          api: back.api,
          empresa: _petrobras,
          existentes: const {
            'companyId': 1,
            'currentStockPrice': 38.5,
            'sharesOutstanding': 13000,
            'beta': 1.1,
            'totalDebt': 300000,
            'costOfDebt': 0.09,
            'effectiveTaxRate': 0.34,
            'cash': 60000,
            'netDebt': 240000,
            'revenue': 500000,
            'ebitda': 230000,
            'ebit': 160000,
            'capex': 70000,
            'depreciation': 70000,
            'workingCapital': 20000,
          },
        ),
      );

      expect(find.text('38,5'), findsOneWidget);
      expect(find.text('9'), findsOneWidget);
      await _preencher(tester, 'Preço atual da ação', '40');
      await _salvar(tester);

      expect(back.requisicoes.single.method, 'PUT');
      expect(back.requisicoes.single.url.path, '/market-data/1');
      expect(back.ultimoCorpo['currentStockPrice'], 40);
      expect(back.ultimoCorpo['costOfDebt'], 0.09);
    });
  });

  group('Formulário de premissas', () {
    testWidgets('envia anos pela quantidade de crescimentos', (tester) async {
      final back = _BackFalso();
      await _abrir(
        tester,
        FormularioPremissas(api: back.api, empresa: _petrobras),
      );
      await _preencher(tester, 'Crescimento da receita por ano', '5; 4; 3');
      await _preencher(tester, 'Margem EBITDA projetada', '45');
      await _preencher(tester, 'Capex (% da receita)', '14');
      await _preencher(
        tester,
        'Variação do capital de giro (% da receita)',
        '1',
      );
      await _preencher(tester, 'Crescimento na perpetuidade', '3');
      await _salvar(tester);

      expect(back.requisicoes.single.method, 'POST');
      expect(back.ultimoCorpo, {
        'companyId': 1,
        'projectionYears': 3,
        'revenueGrowthByYear': [0.05, 0.04, 0.03],
        'projectedEbitdaMargin': 0.45,
        'capexPercentOfRevenue': 0.14,
        'workingCapitalChangePercentOfRevenue': 0.01,
        'perpetualGrowthRate': 0.03,
        'terminalValueMethod': 'GORDON',
      });
    });

    testWidgets('múltiplo de saída envia exitMultiple e usa PUT na edição', (
      tester,
    ) async {
      final back = _BackFalso();
      await _abrir(
        tester,
        FormularioPremissas(
          api: back.api,
          empresa: _petrobras,
          existentes: const {
            'companyId': 1,
            'projectionYears': 3,
            'riskFreeRate': 0.045,
            'marketRiskPremium': 0.055,
            'revenueGrowthByYear': [0.05, 0.04, 0.03],
            'projectedEbitdaMargin': 0.45,
            'capexPercentOfRevenue': 0.14,
            'workingCapitalChangePercentOfRevenue': 0.01,
            'perpetualGrowthRate': 0.03,
            'terminalValueMethod': 'GORDON',
            'exitMultiple': null,
            'discountRate': 0.0882,
          },
        ),
      );

      expect(find.text('5; 4; 3'), findsOneWidget);
      expect(find.text('WACC atual: 8,82%'), findsOneWidget);

      await tester.tap(find.text('Múltiplo de saída'));
      await tester.pumpAndSettle();
      await _preencher(tester, 'Múltiplo de saída (EV/EBITDA)', '6');
      await _preencher(tester, 'Crescimento da receita por ano', '10; 8');
      await _salvar(tester);

      expect(back.requisicoes.single.method, 'PUT');
      expect(back.requisicoes.single.url.path, '/premissas/1');
      expect(back.ultimoCorpo['projectionYears'], 2);
      expect(back.ultimoCorpo['revenueGrowthByYear'], [0.1, 0.08]);
      expect(back.ultimoCorpo['terminalValueMethod'], 'EXIT_MULTIPLE');
      expect(back.ultimoCorpo['exitMultiple'], 6);
      expect(back.ultimoCorpo['riskFreeRate'], 0.045);
    });
  });
}
