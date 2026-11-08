/// Nomes dos campos do back-end, como o usuário vê nas telas do app.
const _nomesDosCampos = {
  'companyId': 'Empresa',
  'currentStockPrice': 'Preço atual da ação',
  'sharesOutstanding': 'Ações emitidas',
  'beta': 'Beta',
  'totalDebt': 'Dívida bruta total',
  'costOfDebt': 'Custo da dívida',
  'effectiveTaxRate': 'Alíquota efetiva de IR',
  'cash': 'Caixa e equivalentes',
  'netDebt': 'Dívida líquida',
  'revenue': 'Receita líquida',
  'ebitda': 'EBITDA',
  'ebit': 'EBIT',
  'capex': 'Capex',
  'depreciation': 'Depreciação e amortização',
  'workingCapital': 'Capital de giro líquido',
  'projectionYears': 'Anos de projeção',
  'revenueGrowthByYear': 'Crescimento da receita por ano',
  'projectedEbitdaMargin': 'Margem EBITDA projetada',
  'capexPercentOfRevenue': 'Capex (% da receita)',
  'workingCapitalChangePercentOfRevenue':
      'Variação do capital de giro (% da receita)',
  'perpetualGrowthRate': 'Crescimento na perpetuidade',
  'terminalValueMethod': 'Método do valor terminal',
  'exitMultiple': 'Múltiplo de saída',
  'riskFreeRate': 'Taxa livre de risco',
  'marketRiskPremium': 'Prêmio de risco de mercado',
  'discountRate': 'Taxa de desconto (WACC)',
};

/// Troca os nomes técnicos de campos (ex.: `perpetualGrowthRate`) pelos
/// nomes usados nas telas (ex.: "Crescimento na perpetuidade") nas
/// mensagens de erro do back-end.
String traduzirMensagem(String mensagem) {
  final padrao = RegExp(
    r'\b(' + _nomesDosCampos.keys.join('|') + r')\b',
    caseSensitive: true,
  );
  return mensagem.replaceAllMapped(padrao, (m) => _nomesDosCampos[m.group(1)]!);
}
