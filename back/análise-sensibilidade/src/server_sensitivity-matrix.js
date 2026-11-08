import express from 'express';
import cors from 'cors';

import { criarAssinatura } from './assinatura-eventos.js';

const app = express();
const PORT = process.env.PORT || 3005;
const EVENT_BUS_URL = process.env.EVENT_BUS_URL || 'http://localhost:3006';
// Endereco em que o barramento entrega os eventos para este servico.
const EVENTS_URL = process.env.EVENTS_URL || `http://localhost:${PORT}/events`;

const DEFAULT_WACC_STEPS = [-0.02, -0.01, 0, 0.01, 0.02];
const DEFAULT_G_STEPS = [-0.01, -0.005, 0, 0.005, 0.01];
const DEFAULT_EBITDA_MARGIN_STEPS = [-0.03, -0.015, 0, 0.015, 0.03];

app.use(cors());
app.use(express.json());

function nowIso() {
  return new Date().toISOString();
}

function parseCompanyId(value) {
  const companyId = Number(value);
  if (!Number.isInteger(companyId) || companyId <= 0) {
    return { error: 'companyId deve ser um inteiro positivo.' };
  }
  return { value: companyId };
}

function normalizeSteps(rawSteps, defaultSteps, fieldName) {
  if (rawSteps === undefined) {
    return { value: [...defaultSteps] };
  }

  if (!Array.isArray(rawSteps) || rawSteps.length === 0) {
    return { error: `${fieldName} deve ser um array nao vazio de variacoes numericas.` };
  }

  const parsedSteps = [];
  for (const step of rawSteps) {
    const parsedStep = Number(step);
    if (!Number.isFinite(parsedStep)) {
      return { error: `Cada valor de ${fieldName} deve ser numerico.` };
    }
    parsedSteps.push(parsedStep);
  }

  return { value: parsedSteps };
}

function roundToTwo(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

// Copia local de empresas, dados de mercado e premissas, recebida pelos
// eventos do barramento. Assim os cenarios sao calculados aqui mesmo, sem
// chamar o ms-valuation nem nenhum outro microsservico.
const companiesById = {};
const marketDataByCompany = {};
const assumptionsByCompany = {};

const CONSUMED_EVENT_TYPES = [
  'COMPANY_UPSERTED',
  'COMPANY_DELETED',
  'MARKET_DATA_UPSERTED',
  'MARKET_DATA_DELETED',
  'ASSUMPTIONS_UPSERTED',
  'ASSUMPTIONS_DELETED'
];

function applyEvent(event) {
  const eventType = String(event?.eventType || '').trim().toUpperCase();
  const payload = event?.payload;

  const upserts = {
    COMPANY_UPSERTED: [companiesById, payload?.id],
    MARKET_DATA_UPSERTED: [marketDataByCompany, payload?.companyId],
    ASSUMPTIONS_UPSERTED: [assumptionsByCompany, payload?.companyId]
  };
  if (upserts[eventType]) {
    const [destino, rawId] = upserts[eventType];
    const idResult = parseCompanyId(rawId);
    if (idResult.error) return { error: idResult.error };
    destino[idResult.value] = payload;
    return { value: { eventType, companyId: idResult.value } };
  }

  const deletes = {
    COMPANY_DELETED: [companiesById, marketDataByCompany, assumptionsByCompany],
    MARKET_DATA_DELETED: [marketDataByCompany],
    ASSUMPTIONS_DELETED: [assumptionsByCompany]
  };
  if (deletes[eventType]) {
    const idResult = parseCompanyId(event.companyId);
    if (idResult.error) return { error: idResult.error };
    for (const mapa of deletes[eventType]) {
      delete mapa[idResult.value];
    }
    return { value: { eventType, companyId: idResult.value } };
  }

  return { value: { eventType, ignorado: true } };
}

const assinatura = criarAssinatura({
  nome: 'analise-sensibilidade',
  eventBusUrl: EVENT_BUS_URL,
  urlDeEventos: EVENTS_URL,
  tipos: CONSUMED_EVENT_TYPES,
  aplicar: applyEvent
});

function loadBaseValuation(companyId) {
  return {
    company: companiesById[companyId] || null,
    marketData: marketDataByCompany[companyId] || null,
    assumptions: assumptionsByCompany[companyId] || null
  };
}

function calculateFairValue(params) {
  const {
    baseRevenue,
    projectionYears,
    revenueGrowthByYear,
    projectedEbitdaMargin,
    capexPercentOfRevenue,
    workingCapitalChangePercentOfRevenue,
    effectiveTaxRate,
    depreciationRate,
    discountRate,
    perpetualGrowthRate,
    terminalValueMethod,
    exitMultiple,
    netDebt,
    sharesOutstanding
  } = params;

  const usaMultiploDeSaida = terminalValueMethod === 'EXIT_MULTIPLE';

  if (!Number.isFinite(discountRate) || !Number.isFinite(perpetualGrowthRate)) {
    return { enterpriseValue: null, equityValue: null, fairValuePerShare: null };
  }

  // A restricao WACC > g so existe no metodo de Gordon.
  if (!usaMultiploDeSaida && discountRate <= perpetualGrowthRate) {
    return { enterpriseValue: null, equityValue: null, fairValuePerShare: null };
  }

  if (usaMultiploDeSaida && !(Number.isFinite(exitMultiple) && exitMultiple > 0)) {
    return { enterpriseValue: null, equityValue: null, fairValuePerShare: null };
  }

  if (!Number.isFinite(baseRevenue) || baseRevenue <= 0) {
    return { enterpriseValue: null, equityValue: null, fairValuePerShare: null };
  }

  if (!Number.isInteger(projectionYears) || projectionYears <= 0) {
    return { enterpriseValue: null, equityValue: null, fairValuePerShare: null };
  }

  let previousRevenue = baseRevenue;
  let discountedCashFlows = 0;
  let lastYearFcff = null;
  let lastYearEbitda = null;

  for (let index = 0; index < projectionYears; index += 1) {
    const year = index + 1;
    const growthRateValue = Number(revenueGrowthByYear[index]);
    const growthRate = Number.isFinite(growthRateValue) ? growthRateValue : 0;

    const revenue = previousRevenue * (1 + growthRate);
    const ebitda = revenue * projectedEbitdaMargin;
    const depreciation = revenue * depreciationRate;
    const ebit = ebitda - depreciation;
    const nopat = ebit * (1 - effectiveTaxRate);
    const capex = revenue * capexPercentOfRevenue;
    const workingCapitalVariation = revenue * workingCapitalChangePercentOfRevenue;
    const fcff = nopat + depreciation - capex - workingCapitalVariation;

    const discountFactor = (1 + discountRate) ** year;
    const presentValueFcff = fcff / discountFactor;

    discountedCashFlows += presentValueFcff;
    lastYearFcff = fcff;
    lastYearEbitda = ebitda;
    previousRevenue = revenue;
  }

  if (!Number.isFinite(lastYearFcff)) {
    return { enterpriseValue: null, equityValue: null, fairValuePerShare: null };
  }

  // Mesmo calculo do ms-valuation: Gordon ou EBITDA do ultimo ano x multiplo.
  const terminalValue = usaMultiploDeSaida
    ? lastYearEbitda * exitMultiple
    : (lastYearFcff * (1 + perpetualGrowthRate)) / (discountRate - perpetualGrowthRate);
  const presentValueTerminalValue = terminalValue / ((1 + discountRate) ** projectionYears);

  const enterpriseValue = discountedCashFlows + presentValueTerminalValue;
  const equityValue = enterpriseValue - netDebt;

  if (!Number.isFinite(equityValue) || sharesOutstanding <= 0) {
    return { enterpriseValue, equityValue, fairValuePerShare: null };
  }

  const rawFairValuePerShare = equityValue / sharesOutstanding;
  const fairValuePerShare = Number.isFinite(rawFairValuePerShare)
    ? roundToTwo(rawFairValuePerShare)
    : null;

  return {
    enterpriseValue,
    equityValue,
    fairValuePerShare
  };
}

function buildWaccVsGMatrix(commonInputs, baseWacc, baseG, waccSteps, gSteps) {
  const rows = [];

  for (const waccStep of waccSteps) {
    const wacc = baseWacc + waccStep;
    const cells = [];

    for (const gStep of gSteps) {
      const g = baseG + gStep;
      const result = calculateFairValue({
        ...commonInputs,
        discountRate: wacc,
        perpetualGrowthRate: g
      });

      cells.push({
        gStep,
        perpetualGrowthRate: g,
        fairValuePerShare: result.fairValuePerShare
      });
    }

    rows.push({
      waccStep,
      discountRate: wacc,
      cells
    });
  }

  return {
    rowAxis: 'discountRate',
    columnAxis: 'perpetualGrowthRate',
    rows
  };
}

function buildWaccVsEbitdaMarginMatrix(commonInputs, baseWacc, baseEbitdaMargin, waccSteps, ebitdaMarginSteps) {
  const rows = [];

  for (const waccStep of waccSteps) {
    const wacc = baseWacc + waccStep;
    const cells = [];

    for (const marginStep of ebitdaMarginSteps) {
      const projectedEbitdaMargin = baseEbitdaMargin + marginStep;
      const result = calculateFairValue({
        ...commonInputs,
        discountRate: wacc,
        projectedEbitdaMargin
      });

      cells.push({
        ebitdaMarginStep: marginStep,
        projectedEbitdaMargin,
        fairValuePerShare: result.fairValuePerShare
      });
    }

    rows.push({
      waccStep,
      discountRate: wacc,
      cells
    });
  }

  return {
    rowAxis: 'discountRate',
    columnAxis: 'projectedEbitdaMargin',
    rows
  };
}

function buildGVsEbitdaMarginMatrix(commonInputs, baseG, baseEbitdaMargin, gSteps, ebitdaMarginSteps) {
  const rows = [];

  for (const gStep of gSteps) {
    const perpetualGrowthRate = baseG + gStep;
    const cells = [];

    for (const marginStep of ebitdaMarginSteps) {
      const projectedEbitdaMargin = baseEbitdaMargin + marginStep;
      const result = calculateFairValue({
        ...commonInputs,
        perpetualGrowthRate,
        projectedEbitdaMargin
      });

      cells.push({
        ebitdaMarginStep: marginStep,
        projectedEbitdaMargin,
        fairValuePerShare: result.fairValuePerShare
      });
    }

    rows.push({
      gStep,
      perpetualGrowthRate,
      cells
    });
  }

  return {
    rowAxis: 'perpetualGrowthRate',
    columnAxis: 'projectedEbitdaMargin',
    rows
  };
}

function validateBaseInputs(baseValuation) {
  const assumptions = baseValuation?.assumptions;
  const marketData = baseValuation?.marketData;

  if (!assumptions || !marketData) {
    return { error: 'Valuation base invalido: assumptions e marketData sao obrigatorios.' };
  }

  if (!Number.isInteger(Number(assumptions.projectionYears)) || Number(assumptions.projectionYears) <= 0) {
    return { error: 'projectionYears invalido no valuation base.' };
  }

  if (!Array.isArray(assumptions.revenueGrowthByYear) || assumptions.revenueGrowthByYear.length === 0) {
    return { error: 'revenueGrowthByYear invalido no valuation base.' };
  }

  const requiredNumbers = [
    ['discountRate', assumptions.discountRate],
    ['perpetualGrowthRate', assumptions.perpetualGrowthRate],
    ['projectedEbitdaMargin', assumptions.projectedEbitdaMargin],
    ['capexPercentOfRevenue', assumptions.capexPercentOfRevenue],
    ['workingCapitalChangePercentOfRevenue', assumptions.workingCapitalChangePercentOfRevenue],
    ['effectiveTaxRate', marketData.effectiveTaxRate],
    ['revenue', marketData.revenue],
    ['depreciation', marketData.depreciation],
    ['netDebt', marketData.netDebt],
    ['sharesOutstanding', marketData.sharesOutstanding]
  ];

  for (const [fieldName, value] of requiredNumbers) {
    if (!Number.isFinite(Number(value))) {
      return { error: `Campo ${fieldName} invalido no valuation base.` };
    }
  }

  return { value: true };
}

app.get('/health', (req, res) => {
  res.status(200).json({
    service: 'ms-sensitivity-matrix',
    status: 'ok',
    defaults: {
      waccSteps: DEFAULT_WACC_STEPS,
      gSteps: DEFAULT_G_STEPS,
      ebitdaMarginSteps: DEFAULT_EBITDA_MARGIN_STEPS
    }
  });
});

app.post('/sensitivity/:companyId/matrices', async (req, res) => {
  const companyIdResult = parseCompanyId(req.params.companyId);
  if (companyIdResult.error) {
    return res.status(400).json({ message: companyIdResult.error });
  }

  const waccStepsResult = normalizeSteps(req.body?.waccSteps, DEFAULT_WACC_STEPS, 'waccSteps');
  if (waccStepsResult.error) {
    return res.status(400).json({ message: waccStepsResult.error });
  }

  const gStepsResult = normalizeSteps(req.body?.gSteps, DEFAULT_G_STEPS, 'gSteps');
  if (gStepsResult.error) {
    return res.status(400).json({ message: gStepsResult.error });
  }

  const ebitdaMarginStepsResult = normalizeSteps(
    req.body?.ebitdaMarginSteps,
    DEFAULT_EBITDA_MARGIN_STEPS,
    'ebitdaMarginSteps'
  );
  if (ebitdaMarginStepsResult.error) {
    return res.status(400).json({ message: ebitdaMarginStepsResult.error });
  }

  try {
    const baseValuation = loadBaseValuation(companyIdResult.value);
    if (!baseValuation.marketData || !baseValuation.assumptions) {
      return res.status(422).json({
        message: 'Cadastre os dados de mercado e as premissas desta empresa antes de gerar os cenarios.'
      });
    }

    const baseCheck = validateBaseInputs(baseValuation);
    if (baseCheck.error) {
      return res.status(400).json({ message: baseCheck.error });
    }

    const assumptions = baseValuation.assumptions;
    const marketData = baseValuation.marketData;

    const baseWacc = Number(assumptions.discountRate);
    const baseG = Number(assumptions.perpetualGrowthRate);
    const baseEbitdaMargin = Number(assumptions.projectedEbitdaMargin);
    const terminalValueMethod = String(assumptions.terminalValueMethod || 'GORDON').toUpperCase();
    const exitMultiple = Number(assumptions.exitMultiple);

    const commonInputs = {
      baseRevenue: Number(marketData.revenue),
      projectionYears: Number(assumptions.projectionYears),
      revenueGrowthByYear: assumptions.revenueGrowthByYear.map(Number),
      projectedEbitdaMargin: baseEbitdaMargin,
      capexPercentOfRevenue: Number(assumptions.capexPercentOfRevenue),
      workingCapitalChangePercentOfRevenue: Number(assumptions.workingCapitalChangePercentOfRevenue),
      effectiveTaxRate: Number(marketData.effectiveTaxRate),
      depreciationRate: Number(marketData.revenue) > 0
        ? Number(marketData.depreciation) / Number(marketData.revenue)
        : 0,
      discountRate: baseWacc,
      perpetualGrowthRate: baseG,
      terminalValueMethod,
      exitMultiple,
      netDebt: Number(marketData.netDebt),
      sharesOutstanding: Number(marketData.sharesOutstanding)
    };

    const baseScenario = calculateFairValue(commonInputs);

    const response = {
      companyId: companyIdResult.value,
      company: baseValuation.company || null,
      baseAssumptions: {
        discountRate: baseWacc,
        perpetualGrowthRate: baseG,
        projectedEbitdaMargin: baseEbitdaMargin,
        terminalValueMethod,
        exitMultiple: terminalValueMethod === 'EXIT_MULTIPLE' ? exitMultiple : null
      },
      baseFairValuePerShare: baseScenario.fairValuePerShare,
      stepsUsed: {
        waccSteps: waccStepsResult.value,
        gSteps: gStepsResult.value,
        ebitdaMarginSteps: ebitdaMarginStepsResult.value
      },
      matrices: {
        waccVsG: buildWaccVsGMatrix(
          commonInputs,
          baseWacc,
          baseG,
          waccStepsResult.value,
          gStepsResult.value
        ),
        waccVsEbitdaMargin: buildWaccVsEbitdaMarginMatrix(
          commonInputs,
          baseWacc,
          baseEbitdaMargin,
          waccStepsResult.value,
          ebitdaMarginStepsResult.value
        ),
        gVsEbitdaMargin: buildGVsEbitdaMarginMatrix(
          commonInputs,
          baseG,
          baseEbitdaMargin,
          gStepsResult.value,
          ebitdaMarginStepsResult.value
        )
      },
      calculatedAt: nowIso(),
      source: {
        origem: 'copia local recebida pelos eventos do barramento',
        ultimoEventoAplicado: assinatura.ultimoEventoAplicado()
      }
    };

    return res.status(200).json(response);
  } catch (error) {
    return res.status(500).json({
      message: error?.message || 'Falha ao calcular os cenarios.'
    });
  }
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
  console.log(`Microsservico Sensitivity Matrix ativo na porta ${PORT}`);
  assinatura.iniciar();
});
