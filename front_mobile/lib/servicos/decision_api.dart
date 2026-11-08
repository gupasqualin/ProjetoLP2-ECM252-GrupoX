import '../config/api_config.dart';
import '../modelos/empresa.dart';
import 'api_cliente.dart';

/// Acesso às funcionalidades dos microsserviços do DecisionDCF.
class DecisionApi {
  DecisionApi({ApiCliente? cliente}) : _cliente = cliente ?? ApiCliente();

  final ApiCliente _cliente;

  // ---------- Gestão de Empresas (porta 3001) ----------

  Future<List<Empresa>> listarEmpresas() async {
    final dados = await _cliente.get(ApiConfig.gestaoEmpresas('/empresas'));
    return [
      for (final item in dados as List)
        Empresa.fromJson(item as Map<String, dynamic>),
    ];
  }

  Future<Empresa> cadastrarEmpresa({
    required String nome,
    required String ticker,
    required String setor,
  }) async {
    final dados = await _cliente.post(ApiConfig.gestaoEmpresas('/empresas'), {
      'name': nome,
      'ticker': ticker,
      'sector': setor,
    });
    return Empresa.fromJson(dados as Map<String, dynamic>);
  }

  Future<void> removerEmpresa(int id) =>
      _cliente.delete(ApiConfig.gestaoEmpresas('/empresas/$id'));

  Future<void> solicitarRecalculo(int companyId) => _cliente.post(
    ApiConfig.gestaoEmpresas('/valuations/recalculate'),
    {'companyId': companyId},
  );
}
