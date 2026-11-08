import 'dart:async';
import 'dart:collection';
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

/// Fila de saída de eventos para o barramento.
///
/// Se o barramento estiver fora do ar, os eventos esperam na fila e são
/// enviados, na ordem em que aconteceram, quando ele voltar. Assim nenhuma
/// alteração se perde e a requisição do usuário nunca falha por causa dele.
class FilaDeEventos {
  FilaDeEventos(
    this.eventBusUrl, {
    http.Client? cliente,
    Duration intervalo = const Duration(seconds: 3),
  }) : _cliente = cliente ?? http.Client() {
    _timer = Timer.periodic(intervalo, (_) => enviarPendentes());
  }

  final String eventBusUrl;
  final http.Client _cliente;
  final _pendentes = Queue<Map<String, Object?>>();
  late final Timer _timer;
  Future<void>? _envioEmAndamento;

  int get pendentes => _pendentes.length;

  /// Use como `publicarEvento` em [criarApp].
  void publicar(String eventType, Map<String, Object?> dados) {
    _pendentes.add({'eventType': eventType, ...dados});
    enviarPendentes();
  }

  /// Envia os eventos da fila. Se já houver um envio em andamento, espera
  /// por ele em vez de começar outro (os eventos saem um de cada vez).
  Future<void> enviarPendentes() =>
      _envioEmAndamento ??= _enviar().whenComplete(() {
        _envioEmAndamento = null;
      });

  Future<void> _enviar() async {
    try {
      while (_pendentes.isNotEmpty) {
        final resposta = await _cliente.post(
          Uri.parse('$eventBusUrl/publish'),
          headers: {'Content-Type': 'application/json'},
          body: jsonEncode(_pendentes.first),
        );
        if (resposta.statusCode >= 400 && resposta.statusCode < 500) {
          // Evento recusado pelo barramento: tentar de novo não adianta.
          print('[event-bus] Evento ${_pendentes.first['eventType']} '
              'recusado (HTTP ${resposta.statusCode}).');
        } else if (resposta.statusCode >= 500) {
          throw http.ClientException('HTTP ${resposta.statusCode}');
        }
        _pendentes.removeFirst();
      }
    } on Exception catch (erro) {
      print('[event-bus] Barramento indisponível ($erro); '
          '${_pendentes.length} evento(s) aguardando na fila.');
    }
  }

  void fechar() {
    _timer.cancel();
    _cliente.close();
  }
}

/// Cria um publicador que envia os eventos ao barramento pela [FilaDeEventos].
PublicadorEventos publicadorHttp(String eventBusUrl) =>
    FilaDeEventos(eventBusUrl).publicar;

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
