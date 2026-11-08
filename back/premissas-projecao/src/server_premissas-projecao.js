import express from 'express';
import cors from 'cors';

import { criarAssinatura } from './assinatura-eventos.js';

const app = express();
const PORT = process.env.PORT || 3003;
const EVENT_BUS_URL = process.env.EVENT_BUS_URL || 'http://localhost:3006';
// Endereco em que o barramento entrega os eventos para este servico.
const EVENTS_URL = process.env.EVENTS_URL || `http://localhost:${PORT}/events`;

const DEFAULT_RISK_FREE_RATE = sanitizeRate(process.env.DEFAULT_RISK_FREE_RATE, 0.045);
const DEFAULT_MARKET_RISK_PREMIUM = sanitizeRate(process.env.DEFAULT_MARKET_RISK_PREMIUM, 0.055);

function sanitizeRate(value, fallback) {
  const numberValue = Number(value ?? fallback);
  return Number.isFinite(numberValue) && numberValue >= 0 && numberValue < 1 ? numberValue : fallback;
}

// Fila de saida de eventos: se o barramento estiver fora do ar, os eventos
// esperam aqui e sao enviados, na ordem em que aconteceram, quando ele voltar.
const pendingEvents = [];
let sendingEvents = false;

function publishEvent(eventType, data = {}) {
  pendingEvents.push({ eventType, ...data });
  flushPendingEvents();
}

async function flushPendingEvents() {
  if (sendingEvents) return;
  sendingEvents = true;
  try {
    while (pendingEvents.length > 0) {
      const response = await fetch(`${EVENT_BUS_URL}/publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(pendingEvents[0])
      });
      if (response.status >= 400 && response.status < 500) {
        // Evento recusado pelo barramento: tentar de novo nao adianta.
        console.warn(`[event-bus] Evento ${pendingEvents[0].eventType} recusado (HTTP ${response.status}).`);
      } else if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      pendingEvents.shift();
    }
  } catch (error) {
    console.warn(
      `[event-bus] Barramento indisponivel (${error.message}); ${pendingEvents.length} evento(s) aguardando na fila.`
    );
  } finally {
    sendingEvents = false;
  }
}

setInterval(flushPendingEvents, 3000);

app.use(cors());
app.use(express.json());

const TERMINAL_VALUE_METHODS = ['GORDON', 'EXIT_MULTIPLE'];
const REQUIRED_FIELDS = [
  'companyId',
  'projectionYears',
  'revenueGrowthByYear',
  'projectedEbitdaMargin',
  'capexPercentOfRevenue',
  'workingCapitalChangePercentOfRevenue',
  'perpetualGrowthRate',
  'terminalValueMethod'
];

let assumptionsByCompany = {};

function parseNumericField(value, fieldName) {
  const parsedValue = Number(value);
  if (!Number.isFinite(parsedValue)) {
    return { error: `O campo ${fieldName} deve ser um numero valido.` };
  }
  return { value: parsedValue };
}

function parseCompanyId(value) {
  const companyId = Number(value);
  if (!Number.isInteger(companyId) || companyId <= 0) {
    return { error: 'companyId deve ser um inteiro positivo.' };
  }
  return { value: companyId };
}

function normalizeInput(payload) {
  const normalized = { ...payload };

  for (const [key, value] of Object.entries(normalized)) {
    if (typeof value === 'string') {
      normalized[key] = value.replace(/,/g, '.');
    }
  }

  if (Array.isArray(normalized.revenueGrowthByYear)) {
    normalized.revenueGrowthByYear = normalized.revenueGrowthByYear.map((value) =>
      typeof value === 'string' ? value.replace(/,/g, '.') : value
    );
  }

  return normalized;
}

// Copia local dos dados de mercado necessarios para o WACC, recebida pelos
// eventos do barramento. Assim este servico nao depende do ms-dados-mercado
// estar no ar para salvar premissas.
const WACC_INPUT_FIELDS = [
  'currentStockPrice',
  'sharesOutstanding',
  'beta',
  'totalDebt',
  'costOfDebt',
  'effectiveTaxRate'
];
let marketDataByCompany = {};

const CONSUMED_EVENT_TYPES = ['MARKET_DATA_UPSERTED', 'MARKET_DATA_DELETED', 'COMPANY_DELETED'];

function applyEvent(event) {
  const eventType = String(event?.eventType || '').trim().toUpperCase();

  if (eventType === 'MARKET_DATA_UPSERTED') {
    const companyIdResult = parseCompanyId(event.payload?.companyId);
    if (companyIdResult.error) return { error: companyIdResult.error };

    const waccInputs = { companyId: companyIdResult.value };
    for (const field of WACC_INPUT_FIELDS) {
      const parsed = parseNumericField(event.payload?.[field], field);
      if (parsed.error) return { error: parsed.error };
      waccInputs[field] = parsed.value;
    }
    marketDataByCompany[companyIdResult.value] = waccInputs;
    return { value: { eventType, companyId: companyIdResult.value } };
  }

  if (eventType === 'MARKET_DATA_DELETED' || eventType === 'COMPANY_DELETED') {
    const companyIdResult = parseCompanyId(event.companyId);
    if (companyIdResult.error) return { error: companyIdResult.error };
    delete marketDataByCompany[companyIdResult.value];
    if (eventType === 'COMPANY_DELETED') {
      delete assumptionsByCompany[companyIdResult.value];
    }
    return { value: { eventType, companyId: companyIdResult.value } };
  }

  return { value: { eventType, ignorado: true } };
}

const assinatura = criarAssinatura({
  nome: 'premissas-projecao',
  eventBusUrl: EVENT_BUS_URL,
  urlDeEventos: EVENTS_URL,
  tipos: CONSUMED_EVENT_TYPES,
  aplicar: applyEvent
});

async function fetchMarketData(companyId) {
  const marketData = marketDataByCompany[companyId];
  if (!marketData) {
    return {
      error: 'Cadastre os dados de mercado desta empresa antes de salvar premissas.',
      status: 422
    };
  }
  return { value: marketData };
}

function calculateWaccFromCapm(marketData, riskFreeRate, marketRiskPremium) {
  const equityValue = marketData.currentStockPrice * marketData.sharesOutstanding;
  const debtValue = marketData.totalDebt;
  const totalCapital = equityValue + debtValue;

  if (equityValue <= 0 || totalCapital <= 0) {
    return { error: 'Não foi possível calcular o WACC com os dados de mercado informados.' };
  }

  const costOfEquity = riskFreeRate + marketData.beta * marketRiskPremium;
  const afterTaxCostOfDebt = marketData.costOfDebt * (1 - marketData.effectiveTaxRate);
  const wacc = (equityValue / totalCapital) * costOfEquity + (debtValue / totalCapital) * afterTaxCostOfDebt;

  return {
    value: {
      discountRate: wacc,
      costOfEquity,
      equityValue,
      debtValue,
      totalCapital
    }
  };
}

function validateAndNormalizeAssumptions(payload, options = {}) {
  const { forcedCompanyId } = options;
  const normalizedPayload = normalizeInput(payload);

  for (const field of REQUIRED_FIELDS) {
    if (normalizedPayload[field] === undefined || normalizedPayload[field] === null) {
      return { error: `O campo ${field} e obrigatorio.` };
    }
  }

  const companyIdResult = parseCompanyId(forcedCompanyId ?? normalizedPayload.companyId);
  if (companyIdResult.error) {
    return { error: companyIdResult.error };
  }

  if (normalizedPayload.discountRate !== undefined && normalizedPayload.discountRate !== null) {
    return { error: 'discountRate nao deve ser informado manualmente; ele e calculado automaticamente via CAPM/WACC.' };
  }

  if (forcedCompanyId !== undefined && Number(normalizedPayload.companyId) !== forcedCompanyId) {
    return { error: 'O companyId do corpo da requisicao deve ser igual ao da rota.' };
  }

  const projectionYearsNumber = Number(normalizedPayload.projectionYears);
  if (!Number.isInteger(projectionYearsNumber) || projectionYearsNumber <= 0 || projectionYearsNumber > 20) {
    return { error: 'projectionYears nao pode ser maior que 20.' };
  }

  if (!Array.isArray(normalizedPayload.revenueGrowthByYear)) {
    return { error: 'revenueGrowthByYear deve ser um array de taxas por ano.' };
  }

  if (normalizedPayload.revenueGrowthByYear.length !== projectionYearsNumber) {
    return { error: 'revenueGrowthByYear deve ter exatamente projectionYears elementos.' };
  }

  const normalizedRevenueGrowth = [];
  for (const growth of normalizedPayload.revenueGrowthByYear) {
    const growthResult = parseNumericField(growth, 'revenueGrowthByYear');
    if (growthResult.error) {
      return { error: growthResult.error };
    }

    if (growthResult.value <= -1) {
      return { error: 'Cada crescimento de receita deve ser maior que -1.' };
    }

    normalizedRevenueGrowth.push(growthResult.value);
  }

  const riskFreeRateResult = parseNumericField(
    normalizedPayload.riskFreeRate ?? DEFAULT_RISK_FREE_RATE,
    'riskFreeRate'
  );
  if (riskFreeRateResult.error) {
    return { error: riskFreeRateResult.error };
  }

  if (riskFreeRateResult.value < 0 || riskFreeRateResult.value >= 1) {
    return { error: 'riskFreeRate deve ser maior ou igual a 0 e menor que 1.' };
  }

  const marketRiskPremiumResult = parseNumericField(
    normalizedPayload.marketRiskPremium ?? DEFAULT_MARKET_RISK_PREMIUM,
    'marketRiskPremium'
  );
  if (marketRiskPremiumResult.error) {
    return { error: marketRiskPremiumResult.error };
  }

  if (marketRiskPremiumResult.value < 0 || marketRiskPremiumResult.value >= 1) {
    return { error: 'marketRiskPremium deve ser maior ou igual a 0 e menor que 1.' };
  }

  const ebitdaMarginResult = parseNumericField(normalizedPayload.projectedEbitdaMargin, 'projectedEbitdaMargin');
  if (ebitdaMarginResult.error) {
    return { error: ebitdaMarginResult.error };
  }

  if (ebitdaMarginResult.value < 0 || ebitdaMarginResult.value > 1) {
    return { error: 'projectedEbitdaMargin deve estar entre 0 e 1.' };
  }

  const capexPercentResult = parseNumericField(normalizedPayload.capexPercentOfRevenue, 'capexPercentOfRevenue');
  if (capexPercentResult.error) {
    return { error: capexPercentResult.error };
  }

  if (capexPercentResult.value < 0 || capexPercentResult.value > 1) {
    return { error: 'capexPercentOfRevenue deve estar entre 0 e 1.' };
  }

  const workingCapitalResult = parseNumericField(
    normalizedPayload.workingCapitalChangePercentOfRevenue,
    'workingCapitalChangePercentOfRevenue'
  );
  if (workingCapitalResult.error) {
    return { error: workingCapitalResult.error };
  }

  if (workingCapitalResult.value <= -1 || workingCapitalResult.value >= 1) {
    return { error: 'workingCapitalChangePercentOfRevenue deve estar entre -1 e 1.' };
  }

  const perpetualGrowthRateResult = parseNumericField(
    normalizedPayload.perpetualGrowthRate,
    'perpetualGrowthRate'
  );
  if (perpetualGrowthRateResult.error) {
    return { error: perpetualGrowthRateResult.error };
  }

  if (perpetualGrowthRateResult.value < 0) {
    return { error: 'perpetualGrowthRate deve ser maior ou igual a 0.' };
  }

  const method = String(normalizedPayload.terminalValueMethod).trim().toUpperCase();
  if (!TERMINAL_VALUE_METHODS.includes(method)) {
    return { error: 'terminalValueMethod deve ser GORDON ou EXIT_MULTIPLE.' };
  }

  let normalizedExitMultiple = null;
  if (method === 'EXIT_MULTIPLE') {
    const exitMultipleResult = parseNumericField(normalizedPayload.exitMultiple, 'exitMultiple');
    if (exitMultipleResult.error) {
      return { error: 'exitMultiple e obrigatorio quando terminalValueMethod for EXIT_MULTIPLE.' };
    }

    if (exitMultipleResult.value <= 0) {
      return { error: 'exitMultiple deve ser maior que 0.' };
    }

    normalizedExitMultiple = exitMultipleResult.value;
  }

  return {
    value: {
      companyId: companyIdResult.value,
      projectionYears: projectionYearsNumber,
      riskFreeRate: riskFreeRateResult.value,
      marketRiskPremium: marketRiskPremiumResult.value,
      revenueGrowthByYear: normalizedRevenueGrowth,
      projectedEbitdaMargin: ebitdaMarginResult.value,
      capexPercentOfRevenue: capexPercentResult.value,
      workingCapitalChangePercentOfRevenue: workingCapitalResult.value,
      perpetualGrowthRate: perpetualGrowthRateResult.value,
      terminalValueMethod: method,
      exitMultiple: normalizedExitMultiple
    }
  };
}

async function validateNormalizeAndComputeAssumptions(payload, options = {}) {
  const normalized = validateAndNormalizeAssumptions(payload, options);
  if (normalized.error) {
    return normalized;
  }

  const marketDataResult = await fetchMarketData(normalized.value.companyId);
  if (marketDataResult.error) {
    return { error: marketDataResult.error, status: marketDataResult.status };
  }

  const waccResult = calculateWaccFromCapm(
    marketDataResult.value,
    normalized.value.riskFreeRate,
    normalized.value.marketRiskPremium
  );

  if (waccResult.error) {
    return { error: waccResult.error };
  }

  if (normalized.value.perpetualGrowthRate >= waccResult.value.discountRate) {
    return { error: 'perpetualGrowthRate deve ser menor que a taxa de desconto calculada via CAPM/WACC.' };
  }

  return {
    value: {
      ...normalized.value,
      ...waccResult.value,
      discountRate: waccResult.value.discountRate
    }
  };
}

app.get('/health', (req, res) => {
  res.status(200).json({
    service: 'ms-premissas-projecao',
    status: 'ok'
  });
});

app.get('/premissas', (req, res) => {
  const list = Object.values(assumptionsByCompany).sort((a, b) => a.companyId - b.companyId);
  return res.status(200).json(list);
});

app.get('/premissas/:companyId', (req, res) => {
  const companyIdResult = parseCompanyId(req.params.companyId);
  if (companyIdResult.error) {
    return res.status(400).json({ message: companyIdResult.error });
  }

  const assumptions = assumptionsByCompany[companyIdResult.value];
  if (!assumptions) {
    return res.status(404).json({ message: 'Premissas nao encontradas para esta empresa.' });
  }

  return res.status(200).json(assumptions);
});

app.post('/premissas', async (req, res) => {
  const normalized = await validateNormalizeAndComputeAssumptions(req.body);
  if (normalized.error) {
    return res.status(normalized.status || 400).json({ message: normalized.error });
  }

  const { companyId } = normalized.value;
  if (assumptionsByCompany[companyId]) {
    return res.status(409).json({
      message: 'Ja existem premissas cadastradas para esta empresa. Use PUT para atualizar.'
    });
  }

  assumptionsByCompany[companyId] = normalized.value;
  res.status(201).json(normalized.value);
  publishEvent('ASSUMPTIONS_UPSERTED', { payload: normalized.value });
});

app.put('/premissas/:companyId', async (req, res) => {
  const companyIdResult = parseCompanyId(req.params.companyId);
  if (companyIdResult.error) {
    return res.status(400).json({ message: companyIdResult.error });
  }

  const companyId = companyIdResult.value;
  if (!assumptionsByCompany[companyId]) {
    return res.status(404).json({ message: 'Premissas nao encontradas para esta empresa.' });
  }

  const normalized = await validateNormalizeAndComputeAssumptions(req.body, { forcedCompanyId: companyId });
  if (normalized.error) {
    return res.status(normalized.status || 400).json({ message: normalized.error });
  }

  assumptionsByCompany[companyId] = normalized.value;
  res.status(200).json(normalized.value);
  publishEvent('ASSUMPTIONS_UPSERTED', { payload: normalized.value });
});

app.delete('/premissas/:companyId', (req, res) => {
  const companyIdResult = parseCompanyId(req.params.companyId);
  if (companyIdResult.error) {
    return res.status(400).json({ message: companyIdResult.error });
  }

  const companyId = companyIdResult.value;
  if (!assumptionsByCompany[companyId]) {
    return res.status(404).json({ message: 'Premissas nao encontradas para esta empresa.' });
  }

  delete assumptionsByCompany[companyId];
  res.status(204).send();
  publishEvent('ASSUMPTIONS_DELETED', { companyId });
});

app.post('/events', (req, res) => {
  const events = Array.isArray(req.body) ? req.body : [req.body];
  const results = events.map((event) => assinatura.receber(event));
  const failed = results.find((result) => result?.error);
  if (failed) {
    return res.status(400).json({ message: failed.error });
  }
  return res.status(202).json({ message: 'Eventos processados.', results });
});

app.listen(PORT, () => {
  console.log(`Microsservico Premissas de Projecao ativo na porta ${PORT}`);
  assinatura.iniciar();
});
