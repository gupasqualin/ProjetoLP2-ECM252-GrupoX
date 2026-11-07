import 'dart:io';

import 'package:gestao_empresas/gestao_empresas.dart';
import 'package:shelf/shelf_io.dart' as shelf_io;

Future<void> main() async {
  final porta = int.tryParse(Platform.environment['PORT'] ?? '') ?? 3001;
  final eventBusUrl =
      Platform.environment['EVENT_BUS_URL'] ?? 'http://localhost:3006';

  final app = criarApp(publicarEvento: publicadorHttp(eventBusUrl));

  await shelf_io.serve(app, InternetAddress.anyIPv4, porta);
  print('Microsserviço Gestão de Empresas (Dart) ativo na porta $porta');
}
