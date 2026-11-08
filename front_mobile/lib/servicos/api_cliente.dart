import 'dart:async';
import 'dart:convert';

import 'package:http/http.dart' as http;

/// Erro de comunicação com o back-end, já com uma mensagem para o usuário.
class ApiException implements Exception {
  final String mensagem;
  final int? status;

  ApiException(this.mensagem, {this.status});

  @override
  String toString() => mensagem;
}

/// Faz as requisições HTTP com JSON e transforma erros em [ApiException].
class ApiCliente {
  ApiCliente({http.Client? cliente}) : _http = cliente ?? http.Client();

  final http.Client _http;
  static const _tempoLimite = Duration(seconds: 15);
  static const _cabecalhos = {'Content-Type': 'application/json'};

  Future<dynamic> get(Uri uri) => _enviar(uri, () => _http.get(uri));

  Future<dynamic> post(Uri uri, [Object? corpo]) => _enviar(
    uri,
    () => _http.post(uri, headers: _cabecalhos, body: jsonEncode(corpo ?? {})),
  );

  Future<dynamic> put(Uri uri, Object corpo) => _enviar(
    uri,
    () => _http.put(uri, headers: _cabecalhos, body: jsonEncode(corpo)),
  );

  Future<dynamic> delete(Uri uri) => _enviar(uri, () => _http.delete(uri));

  Future<dynamic> _enviar(
    Uri uri,
    Future<http.Response> Function() requisicao,
  ) async {
    final http.Response resposta;
    try {
      resposta = await requisicao().timeout(_tempoLimite);
    } on TimeoutException {
      throw ApiException(
        'O servidor ${uri.host}:${uri.port} demorou demais para responder.',
      );
    } on http.ClientException {
      throw ApiException(
        'Não foi possível conectar a ${uri.host}:${uri.port}. '
        'Verifique se o back-end está rodando.',
      );
    }

    final corpo = _decodificar(resposta);
    if (resposta.statusCode >= 200 && resposta.statusCode < 300) {
      return corpo;
    }

    final mensagem = corpo is Map && corpo['message'] is String
        ? corpo['message'] as String
        : 'Erro ${resposta.statusCode} ao acessar o servidor.';
    throw ApiException(mensagem, status: resposta.statusCode);
  }

  dynamic _decodificar(http.Response resposta) {
    final texto = utf8.decode(resposta.bodyBytes, allowMalformed: true);
    if (texto.trim().isEmpty) return null;
    try {
      return jsonDecode(texto);
    } on FormatException {
      return null;
    }
  }
}
