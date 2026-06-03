import { DEFAULT_RISK_FREE_RATE, DEFAULT_MARKET_RISK_PREMIUM } from './config.js';

const TERMINAL_VALUE_METHODS = ['GORDON', 'EXIT_MULTIPLE'];

const MARKET_DATA_FIELDS = [
  'companyId',
  'currentStockPrice',
  'sharesOutstanding',
  'beta',
  'totalDebt',
  'costOfDebt',
  'effectiveTaxRate',
  'cash',
  'netDebt',
  'revenue',
  'ebitda',
  'ebit',
  'capex',
  'depreciation',
  'workingCapital'
];

const ASSUMPTIONS_FIELDS = [
  'companyId',
  'projectionYears',
  'discountRate',
  'revenueGrowthByYear',
  'projectedEbitdaMargin',
  'capexPercentOfRevenue',
  'workingCapitalChangePercentOfRevenue',
  'perpetualGrowthRate',
  'terminalValueMethod'
];

function parseCompanyId(value) {
  const companyId = Number(value);
  if (!Number.isInteger(companyId) || companyId <= 0) {
    return { error: 'companyId deve ser um inteiro positivo.' };
  }
  return { value: companyId };
}

function parseNumber(value, fieldName) {
  const parsedValue = Number(value);
  if (!Number.isFinite(parsedValue)) {
    return { error: `O campo ${fieldName} deve ser um numero valido.` };
  }
  return { value: parsedValue };
}

function normalizePayload(payload) {
  if (!payload || typeof payload !== 'object') {
    return {};
  }

  const normalized = { ...payload };
  for (const key of Object.keys(normalized)) {
    if (typeof normalized[key] === 'string') {
      normalized[key] = normalized[key].replace(/,/g, '.');
    }
  }

  if (Array.isArray(normalized.revenueGrowthByYear)) {
    normalized.revenueGrowthByYear = normalized.revenueGrowthByYear.map((value) =>
      typeof value === 'string' ? value.replace(/,/g, '.') : value
    );
  }

  return normalized;
}

function validateCompany(payload) {
  if (!payload || typeof payload !== 'object') {
    return { error: 'Payload de company invalido.' };
  }

  const idResult = parseCompanyId(payload.id);
  if (idResult.error) {
    return { error: 'Campo id da empresa invalido.' };
  }

  const name = String(payload.name || '').trim();
  const ticker = String(payload.ticker || '').trim().toUpperCase();
  const sector = String(payload.sector || '').trim();

  if (!name || !ticker || !sector) {
    return { error: 'Campos obrigatorios para empresa: id, name, ticker e sector.' };
  }

  return { value: { id: idResult.value, name, ticker, sector } };
}

function requireFields(payload, fields) {
  for (const field of fields) {
    if (payload[field] === undefined || payload[field] === null) {
      return { error: `O campo ${field} e obrigatorio.` };
    }
  }
  return { value: true };
}

function validateMarketData(rawPayload, options = {}) {
  const payload = normalizePayload(rawPayload);
  const requiredCheck = requireFields(payload, MARKET_DATA_FIELDS);
  if (requiredCheck.error) {
    return { error: requiredCheck.error };
  }

  if (options.forcedCompanyId !== undefined && Number(payload.companyId) !== options.forcedCompanyId) {
    return { error: 'O companyId do corpo da requisicao deve ser igual ao da rota.' };
  }

  const companyIdResult = parseCompanyId(options.forcedCompanyId ?? payload.companyId);
  if (companyIdResult.error) {
    return { error: companyIdResult.error };
  }

  const normalized = { companyId: companyIdResult.value };
  for (const field of MARKET_DATA_FIELDS) {
    if (field === 'companyId') {
      continue;
    }
    const parsed = parseNumber(payload[field], field);
    if (parsed.error) {
      return { error: parsed.error };
    }
    normalized[field] = parsed.value;
  }

  if (normalized.currentStockPrice <= 0) return { error: 'currentStockPrice deve ser maior que 0.' };
  if (normalized.sharesOutstanding <= 0) return { error: 'sharesOutstanding deve ser maior que 0.' };
  if (normalized.revenue <= 0) return { error: 'revenue deve ser maior que 0.' };
  if (normalized.beta <= 0) return { error: 'beta deve ser maior que 0.' };
  if (normalized.depreciation < 0) return { error: 'depreciation deve ser maior ou igual a 0.' };
  if (normalized.capex < 0) return { error: 'capex deve ser maior ou igual a 0.' };
  if (normalized.costOfDebt < 0 || normalized.costOfDebt > 1) {
    return { error: 'costOfDebt deve estar entre 0 e 1.' };
  }
  if (normalized.effectiveTaxRate < 0 || normalized.effectiveTaxRate > 1) {
    return { error: 'effectiveTaxRate deve estar entre 0 e 1.' };
  }

  return { value: normalized };
}

function validateAssumptions(rawPayload, options = {}) {
  const payload = normalizePayload(rawPayload);
  const requiredCheck = requireFields(payload, ASSUMPTIONS_FIELDS);
  if (requiredCheck.error) {
    return { error: requiredCheck.error };
  }

  if (options.forcedCompanyId !== undefined && Number(payload.companyId) !== options.forcedCompanyId) {
    return { error: 'O companyId do corpo da requisicao deve ser igual ao da rota.' };
  }

  const companyIdResult = parseCompanyId(options.forcedCompanyId ?? payload.companyId);
  if (companyIdResult.error) {
    return { error: companyIdResult.error };
  }

  const projectionYears = Number(payload.projectionYears);
  if (!Number.isInteger(projectionYears) || projectionYears <= 0 || projectionYears > 20) {
    return { error: 'projectionYears deve ser um inteiro positivo (max 20).' };
  }

  if (!Array.isArray(payload.revenueGrowthByYear)) {
    return { error: 'revenueGrowthByYear deve ser um array.' };
  }

  if (payload.revenueGrowthByYear.length !== projectionYears) {
    return { error: 'revenueGrowthByYear deve ter exatamente projectionYears elementos.' };
  }

  const revenueGrowthByYear = [];
  for (const growth of payload.revenueGrowthByYear) {
    const growthResult = parseNumber(growth, 'revenueGrowthByYear');
    if (growthResult.error) {
      return { error: growthResult.error };
    }
    if (growthResult.value <= -1) {
      return { error: 'Cada crescimento de receita deve ser maior que -1.' };
    }
    revenueGrowthByYear.push(growthResult.value);
  }

  const discountRate = parseNumber(payload.discountRate, 'discountRate');
  if (discountRate.error) return { error: discountRate.error };
  if (discountRate.value <= 0 || discountRate.value >= 1) {
    return { error: 'discountRate deve ser maior que 0 e menor que 1.' };
  }

  const riskFreeRate = parseNumber(payload.riskFreeRate ?? DEFAULT_RISK_FREE_RATE, 'riskFreeRate');
  if (riskFreeRate.error) return { error: riskFreeRate.error };
  if (riskFreeRate.value < 0 || riskFreeRate.value >= 1) {
    return { error: 'riskFreeRate deve ser maior ou igual a 0 e menor que 1.' };
  }

  const marketRiskPremium = parseNumber(
    payload.marketRiskPremium ?? DEFAULT_MARKET_RISK_PREMIUM,
    'marketRiskPremium'
  );
  if (marketRiskPremium.error) return { error: marketRiskPremium.error };
  if (marketRiskPremium.value < 0 || marketRiskPremium.value >= 1) {
    return { error: 'marketRiskPremium deve ser maior ou igual a 0 e menor que 1.' };
  }

  const projectedEbitdaMargin = parseNumber(payload.projectedEbitdaMargin, 'projectedEbitdaMargin');
  if (projectedEbitdaMargin.error) return { error: projectedEbitdaMargin.error };
  if (projectedEbitdaMargin.value < 0 || projectedEbitdaMargin.value > 1) {
    return { error: 'projectedEbitdaMargin deve estar entre 0 e 1.' };
  }

  const capexPercentOfRevenue = parseNumber(payload.capexPercentOfRevenue, 'capexPercentOfRevenue');
  if (capexPercentOfRevenue.error) return { error: capexPercentOfRevenue.error };
  if (capexPercentOfRevenue.value < 0 || capexPercentOfRevenue.value > 1) {
    return { error: 'capexPercentOfRevenue deve estar entre 0 e 1.' };
  }

  const workingCapitalChangePercentOfRevenue = parseNumber(
    payload.workingCapitalChangePercentOfRevenue,
    'workingCapitalChangePercentOfRevenue'
  );
  if (workingCapitalChangePercentOfRevenue.error) return { error: workingCapitalChangePercentOfRevenue.error };
  if (workingCapitalChangePercentOfRevenue.value <= -1 || workingCapitalChangePercentOfRevenue.value >= 1) {
    return { error: 'workingCapitalChangePercentOfRevenue deve estar entre -1 e 1.' };
  }

  const perpetualGrowthRate = parseNumber(payload.perpetualGrowthRate, 'perpetualGrowthRate');
  if (perpetualGrowthRate.error) return { error: perpetualGrowthRate.error };
  if (perpetualGrowthRate.value < 0 || perpetualGrowthRate.value >= discountRate.value) {
    return { error: 'perpetualGrowthRate deve ser maior ou igual a 0 e menor que discountRate.' };
  }

  const method = String(payload.terminalValueMethod).trim().toUpperCase();
  if (!TERMINAL_VALUE_METHODS.includes(method)) {
    return { error: 'terminalValueMethod deve ser GORDON ou EXIT_MULTIPLE.' };
  }

  let exitMultiple = null;
  if (method === 'EXIT_MULTIPLE') {
    const exitMultipleResult = parseNumber(payload.exitMultiple, 'exitMultiple');
    if (exitMultipleResult.error) {
      return { error: 'exitMultiple e obrigatorio quando terminalValueMethod for EXIT_MULTIPLE.' };
    }
    if (exitMultipleResult.value <= 0) {
      return { error: 'exitMultiple deve ser maior que 0.' };
    }
    exitMultiple = exitMultipleResult.value;
  }

  return {
    value: {
      companyId: companyIdResult.value,
      projectionYears,
      discountRate: discountRate.value,
      riskFreeRate: riskFreeRate.value,
      marketRiskPremium: marketRiskPremium.value,
      revenueGrowthByYear,
      projectedEbitdaMargin: projectedEbitdaMargin.value,
      capexPercentOfRevenue: capexPercentOfRevenue.value,
      workingCapitalChangePercentOfRevenue: workingCapitalChangePercentOfRevenue.value,
      perpetualGrowthRate: perpetualGrowthRate.value,
      terminalValueMethod: method,
      exitMultiple
    }
  };
}

export {
  parseCompanyId,
  parseNumber,
  validateCompany,
  validateMarketData,
  validateAssumptions
};
