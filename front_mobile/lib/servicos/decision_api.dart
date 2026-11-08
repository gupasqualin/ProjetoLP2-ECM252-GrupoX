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

  // ---------- Dados de Mercado (porta 3002) ----------

  /// Dados de mercado de todas as empresas, indexados pelo id da empresa.
  Future<Map<int, Map<String, dynamic>>> listarDadosMercado() async =>
      _porEmpresa(await _cliente.get(ApiConfig.dadosMercado('/market-data')));

  /// Cria ([existe] = false) ou atualiza os dados de mercado da empresa.
  Future<Map<String, dynamic>> salvarDadosMercado(
    int companyId,
    Map<String, Object> dados, {
    required bool existe,
  }) async {
    final corpo = {...dados, 'companyId': companyId};
    final resposta = existe
        ? await _cliente.put(
            ApiConfig.dadosMercado('/market-data/$companyId'),
            corpo,
          )
        : await _cliente.post(ApiConfig.dadosMercado('/market-data'), corpo);
    return resposta as Map<String, dynamic>;
  }

  Future<void> removerDadosMercado(int companyId) =>
      _cliente.delete(ApiConfig.dadosMercado('/market-data/$companyId'));

  // ---------- Premissas de Projeção (porta 3003) ----------

  /// Premissas de todas as empresas, indexadas pelo id da empresa.
  Future<Map<int, Map<String, dynamic>>> listarPremissas() async =>
      _porEmpresa(await _cliente.get(ApiConfig.premissas('/premissas')));

  /// Cria ([existe] = false) ou atualiza as premissas da empresa.
  /// A taxa de desconto (WACC) é calculada pelo back-end.
  Future<Map<String, dynamic>> salvarPremissas(
    int companyId,
    Map<String, Object?> premissas, {
    required bool existe,
  }) async {
    final corpo = {...premissas, 'companyId': companyId};
    final resposta = existe
        ? await _cliente.put(
            ApiConfig.premissas('/premissas/$companyId'),
            corpo,
          )
        : await _cliente.post(ApiConfig.premissas('/premissas'), corpo);
    return resposta as Map<String, dynamic>;
  }

  Future<void> removerPremissas(int companyId) =>
      _cliente.delete(ApiConfig.premissas('/premissas/$companyId'));

  Map<int, Map<String, dynamic>> _porEmpresa(dynamic lista) => {
    for (final item in (lista as List).cast<Map<String, dynamic>>())
      (item['companyId'] as num).toInt(): item,
  };
}
