import 'dart:convert';

import 'package:gestao_empresas/gestao_empresas.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:shelf/shelf.dart';
import 'package:test/test.dart';

void main() {
  late Handler app;
  late List<Map<String, Object?>> eventos;

  setUp(() {
    eventos = [];
    app = criarApp(
      publicarEvento: (tipo, dados) =>
          eventos.add({'eventType': tipo, ...dados}),
    );
  });

  Future<Response> enviar(String metodo, String caminho, [Object? corpo]) {
    return Future.value(app(Request(
      metodo,
      Uri.parse('http://localhost$caminho'),
      body: corpo == null ? null : jsonEncode(corpo),
    )));
  }

  Future<Object?> lerCorpo(Response response) async =>
      jsonDecode(await response.readAsString());

  const vale = {'name': ' Vale ', 'ticker': 'vale3', 'sector': 'Mineração'};

  test('GET /health responde ok', () async {
    final response = await enviar('GET', '/health');
    expect(response.statusCode, 200);
    expect(await lerCorpo(response),
        {'service': 'ms-gestao-empresas', 'status': 'ok'});
  });

  test('POST /empresas cadastra, normaliza e publica COMPANY_UPSERTED',
      () async {
    final response = await enviar('POST', '/empresas', vale);
    final esperado = {
      'id': 1,
      'name': 'Vale',
      'ticker': 'VALE3',
      'sector': 'Mineração',
    };

    expect(response.statusCode, 201);
    expect(await lerCorpo(response), esperado);
    expect(eventos, [
      {'eventType': 'COMPANY_UPSERTED', 'payload': esperado},
    ]);

    final lista = await enviar('GET', '/empresas');
    expect(await lerCorpo(lista), [esperado]);
  });

  test('POST /empresas sem campos obrigatórios responde 400', () async {
    final response = await enviar('POST', '/empresas', {'name': 'Vale'});
    expect(response.statusCode, 400);
    expect(eventos, isEmpty);
  });

  test('POST /empresas com corpo inválido responde 400', () async {
    final response = await app(Request(
      'POST',
      Uri.parse('http://localhost/empresas'),
      body: 'isso nao e json',
    ));
    expect(response.statusCode, 400);
  });

  test('POST /empresas com ticker repetido responde 409', () async {
    await enviar('POST', '/empresas', vale);
    final response = await enviar('POST', '/empresas', {
      ...vale,
      'ticker': 'VALE3',
    });
    expect(response.statusCode, 409);
  });

  test('DELETE /empresas/:id remove e publica COMPANY_DELETED', () async {
    await enviar('POST', '/empresas', vale);
    eventos.clear();

    final response = await enviar('DELETE', '/empresas/1');
    expect(response.statusCode, 204);
    expect(eventos, [
      {'eventType': 'COMPANY_DELETED', 'companyId': 1},
    ]);
    expect(await lerCorpo(await enviar('GET', '/empresas')), isEmpty);
  });

  test('DELETE /empresas/:id inexistente responde 404', () async {
    expect((await enviar('DELETE', '/empresas/99')).statusCode, 404);
    expect((await enviar('DELETE', '/empresas/abc')).statusCode, 404);
  });

  test('POST /valuations/recalculate publica o evento de recálculo', () async {
    await enviar('POST', '/empresas', vale);
    eventos.clear();

    final response =
        await enviar('POST', '/valuations/recalculate', {'companyId': '1'});
    expect(response.statusCode, 202);
    expect(eventos, [
      {'eventType': 'VALUATION_RECALCULATE_REQUESTED', 'companyId': 1},
    ]);
  });

  test('POST /valuations/recalculate valida o companyId', () async {
    final invalido =
        await enviar('POST', '/valuations/recalculate', {'companyId': -1});
    expect(invalido.statusCode, 400);

    final inexistente =
        await enviar('POST', '/valuations/recalculate', {'companyId': 7});
    expect(inexistente.statusCode, 404);
    expect(eventos, isEmpty);
  });

  test('responde ao preflight de CORS', () async {
    final response = await enviar('OPTIONS', '/empresas');
    expect(response.statusCode, 204);
    expect(response.headers['access-control-allow-origin'], '*');
  });

  group('FilaDeEventos', () {
    test(
        'guarda os eventos com o barramento fora do ar e envia na ordem quando ele volta',
        () async {
      var barramentoNoAr = false;
      final recebidos = <String>[];
      final fila = FilaDeEventos(
        'http://barramento:3006',
        intervalo: const Duration(hours: 1), // reenvio manual no teste
        cliente: MockClient((requisicao) async {
          if (!barramentoNoAr) {
            throw http.ClientException('Connection refused', requisicao.url);
          }
          final corpo = jsonDecode(requisicao.body) as Map<String, dynamic>;
          recebidos.add('${corpo['eventType']}:${corpo['companyId']}');
          return http.Response('{}', 200);
        }),
      );
      addTearDown(fila.fechar);

      fila.publicar('COMPANY_DELETED', {'companyId': 1});
      fila.publicar('COMPANY_DELETED', {'companyId': 2});
      await fila.enviarPendentes();
      expect(fila.pendentes, 2);
      expect(recebidos, isEmpty);

      barramentoNoAr = true;
      await fila.enviarPendentes();
      expect(fila.pendentes, 0);
      expect(recebidos, ['COMPANY_DELETED:1', 'COMPANY_DELETED:2']);
    });

    test('descarta evento recusado pelo barramento (erro 4xx)', () async {
      final fila = FilaDeEventos(
        'http://barramento:3006',
        intervalo: const Duration(hours: 1),
        cliente: MockClient((_) async => http.Response('{}', 400)),
      );
      addTearDown(fila.fechar);

      fila.publicar('EVENTO_INVALIDO', {});
      await fila.enviarPendentes();
      expect(fila.pendentes, 0);
    });
  });
}
