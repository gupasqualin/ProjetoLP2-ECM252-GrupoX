/// Empresa cadastrada no microsserviço de Gestão de Empresas.
class Empresa {
  final int id;
  final String nome;
  final String ticker;
  final String setor;

  const Empresa({
    required this.id,
    required this.nome,
    required this.ticker,
    required this.setor,
  });

  factory Empresa.fromJson(Map<String, dynamic> json) => Empresa(
    id: (json['id'] as num).toInt(),
    nome: json['name'] as String,
    ticker: json['ticker'] as String,
    setor: json['sector'] as String,
  );

  /// Texto curto para listas e seletores, ex.: "PETR4 · Petrobras".
  String get rotulo => '$ticker · $nome';
}
