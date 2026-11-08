import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:front_mobile/main.dart';
import 'package:front_mobile/servicos/api_cliente.dart';
import 'package:front_mobile/servicos/decision_api.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';

/// Resposta JSON em UTF-8, como o back-end real envia.
http.Response respostaJson(Object corpo, int status) =>
    http.Response.bytes(utf8.encode(jsonEncode(corpo)), status);

void main() {
  DecisionApi apiFalsa(Object respostaEmpresas) => DecisionApi(
    cliente: ApiCliente(
      cliente: MockClient((_) async => respostaJson(respostaEmpresas, 200)),
    ),
  );

  testWidgets('lista as empresas vindas do back-end', (tester) async {
    await tester.pumpWidget(
      DecisionDcfApp(
        api: apiFalsa([
          {
            'id': 1,
            'name': 'Petrobras',
            'ticker': 'PETR4',
            'sector': 'Energia',
          },
        ]),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Petrobras'), findsOneWidget);
    expect(find.text('PETR4 · Energia'), findsOneWidget);
  });

  testWidgets('cadastra empresa e atualiza a lista', (tester) async {
    final empresas = <Map<String, Object>>[];
    final api = DecisionApi(
      cliente: ApiCliente(
        cliente: MockClient((requisicao) async {
          if (requisicao.method == 'POST') {
            final corpo = jsonDecode(requisicao.body) as Map<String, dynamic>;
            final nova = {
              'id': empresas.length + 1,
              'name': corpo['name'] as String,
              'ticker': (corpo['ticker'] as String).toUpperCase(),
              'sector': corpo['sector'] as String,
            };
            empresas.add(nova);
            return respostaJson(nova, 201);
          }
          return respostaJson(empresas, 200);
        }),
      ),
    );

    await tester.pumpWidget(DecisionDcfApp(api: api));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Nova empresa'));
    await tester.pumpAndSettle();

    final campos = find.byType(TextFormField);
    await tester.enterText(campos.at(0), 'Vale');
    await tester.enterText(campos.at(1), 'vale3');
    await tester.enterText(campos.at(2), 'Mineração');
    await tester.tap(find.text('Cadastrar'));
    await tester.pumpAndSettle();

    expect(find.text('VALE3 · Mineração'), findsOneWidget);
  });

  testWidgets('mostra aviso quando não há empresas', (tester) async {
    await tester.pumpWidget(DecisionDcfApp(api: apiFalsa([])));
    await tester.pumpAndSettle();

    expect(find.text('Nenhuma empresa cadastrada'), findsOneWidget);
  });

  test('ApiCliente usa a mensagem de erro do back-end', () async {
    final cliente = ApiCliente(
      cliente: MockClient(
        (_) async => http.Response.bytes(
          utf8.encode(
            jsonEncode({'message': 'Já existe uma empresa com esse ticker.'}),
          ),
          409,
        ),
      ),
    );

    expect(
      () => cliente.get(Uri.parse('http://localhost:3001/empresas')),
      throwsA(
        isA<ApiException>()
            .having((e) => e.mensagem, 'mensagem', contains('ticker'))
            .having((e) => e.status, 'status', 409),
      ),
    );
  });
}
