const state = {
  companiesById: {},
  marketDataByCompany: {},
  assumptionsByCompany: {},
  valuationsByCompany: {}
};

function ensureCompanyStub(companyId) {
  if (!state.companiesById[companyId]) {
    state.companiesById[companyId] = {
      id: companyId,
      name: `Empresa #${companyId}`,
      ticker: '-',
      sector: '-'
    };
  }
}

function buildStateSnapshot() {
  const companyIds = Array.from(
    new Set([
      ...Object.keys(state.companiesById),
      ...Object.keys(state.marketDataByCompany),
      ...Object.keys(state.assumptionsByCompany)
    ])
  )
    .map(Number)
    .sort((a, b) => a - b);

  return companyIds.map((companyId) => ({
    companyId,
    company: state.companiesById[companyId] || null,
    hasMarketData: Boolean(state.marketDataByCompany[companyId]),
    hasAssumptions: Boolean(state.assumptionsByCompany[companyId]),
    hasCachedValuation: Boolean(state.valuationsByCompany[companyId])
  }));
}

export { state, ensureCompanyStub, buildStateSnapshot };
