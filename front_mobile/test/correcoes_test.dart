// Testes das correções feitas depois do teste completo no emulador.
import 'dart:convert';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:front_mobile/main.dart';
import 'package:front_mobile/modelos/empresa.dart';
import 'package:front_mobile/servicos/api_cliente.dart';
import 'package:front_mobile/servicos/decision_api.dart';
import 'package:front_mobile/telas/dados_mercado_tela.dart';
import 'package:front_mobile/telas/sensibilidade_tela.dart';
import 'package:front_mobile/util/mensagens.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';

http.Response _json(Object corpo, [int status = 200]) =>
    http.Response.bytes(utf8.encode(jsonEncode(corpo)), status);

const _empresa = {
  'id': 7,
  'name': 'Magazine Luiza',
  'ticker': 'MGLU3',
  'sector': 'Varejo',
};

/// Back-end falso: só tem a empresa MGLU3, sem dados de mercado nem
/// premissas. Guarda as requisições recebidas.
({DecisionApi api, List<String> requisicoes}) _backSemDados() {
  final requisicoes = <String>[];
  final api = DecisionApi(
    cliente: ApiCliente(
      cliente: MockClient((r) async {
        requisicoes.add('${r.method} ${r.url.path}');
        if (r.url.path == '/empresas') return _json([_empresa]);
        if (r.url.path == '/valuations/recalculate') {
          return _json({'message': 'ok'}, 202);
        }
        return _json({'message': 'não encontrado'}, 404);
      }),
    ),
  );
  return (api: api, requisicoes: requisicoes);
}

Future<void> _abrirMenuERecalcular(WidgetTester tester) async {
  await tester.tap(find.byTooltip('Ações'));
  await tester.pumpAndSettle();
  await tester.tap(find.text('Recalcular valuation'));
  await tester.pumpAndSettle();
}

void main() {
  group('Problema 1: aviso por cima do botão "Nova empresa"', () {
    testWidgets('o aviso empurra o botão para cima', (tester) async {
      final back = _backSemDados();
      await tester.pumpWidget(DecisionDcfApp(api: back.api));
      await tester.pumpAndSettle();

      final botao = find.byType(FloatingActionButton);
      final antes = tester.getRect(botao);

      await _abrirMenuERecalcular(tester); // mostra um aviso
      final aviso = find.byType(SnackBar);
      expect(aviso, findsOneWidget);

      final depois = tester.getRect(botao);
      expect(depois.bottom, lessThan(antes.bottom));
      expect(depois.bottom, lessThanOrEqualTo(tester.getRect(aviso).top));
    });
  });

  group('Problema 2: "Recalcular valuation" sem dados', () {
    testWidgets('avisa o que falta e não pede o recálculo', (tester) async {
      final back = _backSemDados();
      await tester.pumpWidget(DecisionDcfApp(api: back.api));
      await tester.pumpAndSettle();

      await _abrirMenuERecalcular(tester);

      expect(
        find.text(
          'Para calcular o valuation de MGLU3, cadastre antes '
          'os dados de mercado e as premissas.',
        ),
        findsOneWidget,
      );
      expect(back.requisicoes, isNot(contains('POST /valuations/recalculate')));
    });

    testWidgets('com tudo cadastrado, pede o recálculo', (tester) async {
      final requisicoes = <String>[];
      final api = DecisionApi(
        cliente: ApiCliente(
          cliente: MockClient((r) async {
            requisicoes.add('${r.method} ${r.url.path}');
            if (r.url.path == '/empresas') return _json([_empresa]);
            return _json({'companyId': 7}, r.method == 'POST' ? 202 : 200);
          }),
        ),
      );
      await tester.pumpWidget(DecisionDcfApp(api: api));
      await tester.pumpAndSettle();

      await _abrirMenuERecalcular(tester);

      expect(requisicoes, contains('POST /valuations/recalculate'));
      expect(
        find.text(
          'Recálculo de MGLU3 solicitado. Veja o resultado na aba Valuation.',
        ),
        findsOneWidget,
      );
    });
  });

  group('Problema 3: nomes técnicos nas mensagens', () {
    test('troca os nomes dos campos pelos nomes das telas', () {
      expect(
        traduzirMensagem(
          'perpetualGrowthRate deve ser menor que a taxa de desconto '
          'calculada via CAPM/WACC.',
        ),
        'Crescimento na perpetuidade deve ser menor que a taxa de desconto '
        'calculada via CAPM/WACC.',
      );
      expect(
        traduzirMensagem('O campo ebitda é obrigatório.'),
        'O campo EBITDA é obrigatório.',
      );
      expect(
        traduzirMensagem('capexPercentOfRevenue deve estar entre 0 e 1.'),
        'Capex (% da receita) deve estar entre 0 e 1.',
      );
      expect(
        traduzirMensagem('Empresa não encontrada.'),
        'Empresa não encontrada.',
      );
    });

    test('o ApiCliente já entrega a mensagem traduzida', () async {
      final cliente = ApiCliente(
        cliente: MockClient(
          (_) async =>
              _json({'message': 'exitMultiple deve ser maior que 0.'}, 400),
        ),
      );
      expect(
        () => cliente.get(Uri.parse('http://localhost:3003/premissas')),
        throwsA(
          isA<ApiException>().having(
            (e) => e.mensagem,
            'mensagem',
            'Múltiplo de saída deve ser maior que 0.',
          ),
        ),
      );
    });
  });

  group('Problema 4: prefixo "ParallelWaitError"', () {
    testWidgets('mostra só a mensagem quando um serviço falha', (tester) async {
      final api = DecisionApi(
        cliente: ApiCliente(
          cliente: MockClient((r) async {
            if (r.url.path == '/empresas') return _json([_empresa]);
            throw http.ClientException('Connection refused', r.url);
          }),
        ),
      );
      await tester.pumpWidget(MaterialApp(home: DadosMercadoTela(api: api)));
      await tester.pumpAndSettle();

      expect(find.textContaining('ParallelWaitError'), findsNothing);
      expect(
        find.textContaining(RegExp(r'^Não foi possível conectar a .*:3002\.')),
        findsOneWidget,
      );
      expect(find.text('Tentar de novo'), findsOneWidget);
    });

    testWidgets('a aba de cenários tem o mesmo título da barra', (
      tester,
    ) async {
      final back = _backSemDados();
      await tester.pumpWidget(DecisionDcfApp(api: back.api));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Cenários'));
      await tester.pumpAndSettle();

      // Um na barra de navegação e outro no título da tela.
      expect(find.text('Cenários'), findsNWidgets(2));
    });
  });

  group('Problema 5: cenários com múltiplo de saída', () {
    Future<void> mostrar(WidgetTester tester, String arquivo) async {
      final corpo = File('test/dados/$arquivo').readAsStringSync();
      final api = DecisionApi(
        cliente: ApiCliente(
          cliente: MockClient(
            (_) async => http.Response.bytes(utf8.encode(corpo), 200),
          ),
        ),
      );
      await tester.pumpWidget(
        MaterialApp(
          home: DetalheSensibilidade(
            api: api,
            empresa: const Empresa(
              id: 3,
              nome: 'Vale',
              ticker: 'VALE3',
              setor: 'Mineração',
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();
    }

    const aviso =
        'Esta empresa usa múltiplo de saída no valor terminal, '
        'então o crescimento perpétuo não altera o preço justo.';

    testWidgets('explica que o crescimento perpétuo não muda o valor', (
      tester,
    ) async {
      await mostrar(tester, 'sensibilidade_multiplo.json');
      expect(find.text(aviso), findsOneWidget);
    });

    testWidgets('não mostra o aviso para empresas com Gordon', (tester) async {
      await mostrar(tester, 'sensibilidade.json');
      expect(find.text(aviso), findsNothing);
    });
  });
}
