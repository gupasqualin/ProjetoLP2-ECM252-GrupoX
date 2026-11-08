import 'package:flutter/foundation.dart';

/// Endereços dos microsserviços do back-end.
///
/// Pode ser ajustado na hora de rodar o app, sem mudar o código:
///
/// - `--dart-define=API_HOST=192.168.0.10` para usar o IP do computador
///   quando o app roda num celular de verdade.
/// - `--dart-define=API_PORTA_BASE=30000` para usar as NodePorts do
///   Kubernetes (30001 a 30006) em vez das portas do Docker (3001 a 3006).
class ApiConfig {
  static const _hostDefinido = String.fromEnvironment('API_HOST');
  static const _portaBase = int.fromEnvironment(
    'API_PORTA_BASE',
    defaultValue: 3000,
  );

  /// No emulador Android, `10.0.2.2` é o `localhost` do computador.
  static String get host {
    if (_hostDefinido.isNotEmpty) return _hostDefinido;
    if (!kIsWeb && defaultTargetPlatform == TargetPlatform.android) {
      return '10.0.2.2';
    }
    return 'localhost';
  }

  static Uri gestaoEmpresas(String caminho) => _uri(1, caminho);
  static Uri dadosMercado(String caminho) => _uri(2, caminho);
  static Uri premissas(String caminho) => _uri(3, caminho);
  static Uri valuation(String caminho) => _uri(4, caminho);
  static Uri sensibilidade(String caminho) => _uri(5, caminho);

  static Uri _uri(int servico, String caminho) =>
      Uri.parse('http://$host:${_portaBase + servico}$caminho');
}
