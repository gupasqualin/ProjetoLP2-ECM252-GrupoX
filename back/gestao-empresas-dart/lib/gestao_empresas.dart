import 'dart:convert';

import 'package:http/http.dart' as http;
import 'package:shelf/shelf.dart';
import 'package:shelf_router/shelf_router.dart';

/// Função que envia um evento ao barramento de eventos.
typedef PublicadorEventos = void Function(
  String eventType,
  Map<String, Object?> dados,
);

/// Empresa cadastrada na plataforma.
class Empresa {
  final int id;
  final String name;
  final String ticker;
  final String sector;

  Empresa({
    required this.id,
    required this.name,
    required this.ticker,
    required this.sector,
  });

  Map<String, Object?> toJson() => {
        'id': id,
        'name': name,
        'ticker': ticker,
        'sector': sector,
      };
}

/// Cria um publicador que faz `POST /publish` no barramento de eventos.
/// Falhas são só registradas no log, para não derrubar a requisição.
PublicadorEventos publicadorHttp(String eventBusUrl) {
  return (eventType, dados) {
    http
        .post(
      Uri.parse('$eventBusUrl/publish'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({'eventType': eventType, ...dados}),
    )
        .catchError((Object erro) {
      print('[event-bus] Falha ao publicar $eventType: $erro');
      return http.Response('', 500);
    });
  };
}

/// Monta o handler HTTP do microsserviço de Gestão de Empresas.
Handler criarApp({required PublicadorEventos publicarEvento}) {
  final empresas = <Empresa>[];
  var proximoId = 1;
  final router = Router();

  router.get('/health', (Request request) {
    return _json(200, {'service': 'ms-gestao-empresas', 'status': 'ok'});
  });

  router.get('/empresas', (Request request) {
    return _json(200, empresas.map((e) => e.toJson()).toList());
  });

  router.post('/empresas', (Request request) async {
    final corpo = await _lerJson(request);
    final name = _texto(corpo['name']);
    final ticker = _texto(corpo['ticker']);
    final sector = _texto(corpo['sector']);

    if (name.isEmpty || ticker.isEmpty || sector.isEmpty) {
      return _json(400, {
        'message': 'Campos obrigatórios: name, ticker e sector.',
      });
    }

    final jaExiste = empresas.any((e) => e.ticker == ticker.toUpperCase());
    if (jaExiste) {
      return _json(409, {
        'message': 'Já existe uma empresa cadastrada com esse ticker.',
      });
    }

    final nova = Empresa(
      id: proximoId++,
      name: name,
      ticker: ticker.toUpperCase(),
      sector: sector,
    );
    empresas.add(nova);

    publicarEvento('COMPANY_UPSERTED', {'payload': nova.toJson()});
    return _json(201, nova.toJson());
  });

  router.post('/valuations/recalculate', (Request request) async {
    final corpo = await _lerJson(request);
    final companyId = _inteiro(corpo['companyId']);

    if (companyId == null || companyId <= 0) {
      return _json(400, {
        'message': 'companyId deve ser um inteiro positivo.',
      });
    }

    if (!empresas.any((e) => e.id == companyId)) {
      return _json(404, {'message': 'Empresa não encontrada.'});
    }

    publicarEvento('VALUATION_RECALCULATE_REQUESTED', {
      'companyId': companyId,
    });
    return _json(202, {'message': 'Recalculo de valuation enfileirado.'});
  });

  router.delete('/empresas/<id>', (Request request, String id) {
    final companyId = int.tryParse(id);

    if (companyId == null || !empresas.any((e) => e.id == companyId)) {
      return _json(404, {'message': 'Empresa não encontrada.'});
    }

    empresas.removeWhere((e) => e.id == companyId);
    publicarEvento('COMPANY_DELETED', {'companyId': companyId});
    return Response(204);
  });

  return const Pipeline().addMiddleware(_cors()).addHandler(router.call);
}

/// Lê o corpo da requisição como objeto JSON. Corpo vazio ou inválido
/// vira um mapa vazio, e a validação dos campos responde 400.
Future<Map<String, Object?>> _lerJson(Request request) async {
  try {
    final dados = jsonDecode(await request.readAsString());
    return dados is Map<String, Object?> ? dados : {};
  } on FormatException {
    return {};
  }
}

String _texto(Object? valor) => valor == null ? '' : '$valor'.trim();

/// Aceita `3` ou `"3"`, como o `Number()` do JavaScript fazia.
int? _inteiro(Object? valor) {
  if (valor is int) return valor;
  if (valor is double && valor == valor.truncateToDouble()) {
    return valor.toInt();
  }
  if (valor is String) return int.tryParse(valor.trim());
  return null;
}

Response _json(int status, Object corpo) {
  return Response(
    status,
    body: jsonEncode(corpo),
    headers: {'Content-Type': 'application/json; charset=utf-8'},
  );
}

/// Libera o acesso de qualquer origem, como o `cors()` do Express fazia.
Middleware _cors() {
  const cabecalhos = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  return (Handler proximo) {
    return (Request request) async {
      if (request.method == 'OPTIONS') {
        return Response(204, headers: cabecalhos);
      }
      final response = await proximo(request);
      return response.change(headers: cabecalhos);
    };
  };
}
