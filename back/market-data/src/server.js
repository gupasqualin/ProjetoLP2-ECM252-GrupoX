import express from 'express';
import cors from 'cors';

const app = express();
const PORT = process.env.PORT || 3002;

app.use(cors());
app.use(express.json());

const REQUIRED_FIELDS = [
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

const WACC_INPUT_FIELDS = [
  'companyId',
  'currentStockPrice',
  'sharesOutstanding',
  'beta',
  'totalDebt',
  'costOfDebt',
  'effectiveTaxRate'
];

let marketDataByCompany = {
  1: {
    companyId: 1,
    // Current stock quote used in equity market value for WACC.
    currentStockPrice: 39.8,
    // Total issued shares to compute market capitalization.
    sharesOutstanding: 13044000000,
    // Systematic risk used in CAPM.
    beta: 1.1,
    // Gross debt stock used in capital structure.
    totalDebt: 307000000000,
    // Average debt funding cost before tax.
    costOfDebt: 0.09,
    // Effective tax rate used in after-tax debt cost.
    effectiveTaxRate: 0.34,
    // Cash and cash equivalents from balance sheet.
    cash: 93000000000,
    // Net debt position (gross debt less cash).
    netDebt: 214000000000,
    // Last fiscal year net revenue baseline for projections.
    revenue: 490000000000,
    // Last fiscal year EBITDA for operating performance.
    ebitda: 265000000000,
    // Last fiscal year EBIT for operating profit after D&A.
    ebit: 195000000000,
    // Last fiscal year capital expenditures.
    capex: 74000000000,
    // Last fiscal year depreciation and amortization.
    depreciation: 70000000000,
    // Net working capital level, may be negative.
    workingCapital: -12000000000
  },
  2: {
    companyId: 2,
    currentStockPrice: 14.2,
    sharesOutstanding: 15800000000,
    beta: 0.68,
    totalDebt: 22000000000,
    costOfDebt: 0.11,
    effectiveTaxRate: 0.3,
    cash: 16000000000,
    netDebt: 6000000000,
    revenue: 89000000000,
    ebitda: 28500000000,
    ebit: 20800000000,
    capex: 6200000000,
    depreciation: 4100000000,
    workingCapital: 3500000000
  }
};

function parseNumericField(value, fieldName) {
  const parsedValue = Number(value);
  if (!Number.isFinite(parsedValue)) {
    return { error: `O campo ${fieldName} deve ser um número válido.` };
  }
  return { value: parsedValue };
}

function requireFields(payload, requiredFields) {
  for (const field of requiredFields) {
    if (payload[field] === undefined || payload[field] === null) {
      return { error: `O campo ${field} é obrigatório.` };
    }
  }
  return { value: true };
}

function parseCompanyIdParam(rawCompanyId) {
  const companyId = Number(rawCompanyId);
  if (!Number.isInteger(companyId) || companyId <= 0) {
    return { error: 'companyId deve ser um inteiro positivo.' };
  }
  return { value: companyId };
}

function validateAndNormalizeMarketData(payload, options = {}) {
  const { forcedCompanyId } = options;

  const preprocessedPayload = { ...payload };
  for (const field of Object.keys(preprocessedPayload)) {
    if (typeof preprocessedPayload[field] === 'string') {
      preprocessedPayload[field] = preprocessedPayload[field].replace(/,/g, '.');
    }
  }

  const requiredCheck = requireFields(preprocessedPayload, REQUIRED_FIELDS);
  if (requiredCheck.error) {
    return { error: requiredCheck.error };
  }

  if (forcedCompanyId !== undefined && Number(preprocessedPayload.companyId) !== forcedCompanyId) {
    return { error: 'O companyId do corpo da requisição deve ser igual ao da rota.' };
  }

  const companyIdResult = parseCompanyIdParam(forcedCompanyId ?? preprocessedPayload.companyId);
  if (companyIdResult.error) {
    return { error: companyIdResult.error };
  }

  const numericFields = [
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

  const normalized = {
    companyId: companyIdResult.value
  };

  for (const field of numericFields) {
    const parsed = parseNumericField(preprocessedPayload[field], field);
    if (parsed.error) {
      return { error: parsed.error };
    }
    normalized[field] = parsed.value;
  }

  if (normalized.currentStockPrice <= 0) {
    return { error: 'currentStockPrice deve ser maior que 0.' };
  }

  if (normalized.sharesOutstanding <= 0) {
    return { error: 'sharesOutstanding deve ser maior que 0.' };
  }

  if (normalized.beta <= 0) {
    return { error: 'beta deve ser maior que 0.' };
  }

  if (normalized.revenue <= 0) {
    return { error: 'revenue deve ser maior que 0.' };
  }

  if (normalized.capex <= 0) {
    return { error: 'capex deve ser maior que 0.' };
  }

  if (normalized.depreciation <= 0) {
    return { error: 'depreciation deve ser maior que 0.' };
  }

  if (normalized.cash < 0) {
    return { error: 'cash deve ser maior ou igual a 0.' };
  }

  if (normalized.netDebt < 0) {
    return { error: 'netDebt deve ser maior ou igual a 0.' };
  }

  if (normalized.totalDebt < 0) {
    return { error: 'totalDebt deve ser maior ou igual a 0.' };
  }

  if (normalized.costOfDebt < 0 || normalized.costOfDebt > 1) {
    return { error: 'Custo da dívida deve ser um valor entre 0 e 1.' };
  }

  if (normalized.effectiveTaxRate < 0 || normalized.effectiveTaxRate > 1) {
    return { error: 'Alíquota efetiva de imposto deve ser um valor entre 0 e 1.' };
  }

  return { value: normalized };
}

function buildWaccInputs(entry) {
  const response = {};
  for (const field of WACC_INPUT_FIELDS) {
    response[field] = entry[field];
  }
  return response;
}

app.get('/health', (req, res) => {
  res.status(200).json({
    service: 'ms-market-data',
    status: 'ok'
  });
});

app.get('/market-data', (req, res) => {
  const list = Object.values(marketDataByCompany).sort((a, b) => a.companyId - b.companyId);
  res.status(200).json(list);
});

app.get('/market-data/:companyId', (req, res) => {
  const parsedCompanyId = parseCompanyIdParam(req.params.companyId);
  if (parsedCompanyId.error) {
    return res.status(400).json({ message: parsedCompanyId.error });
  }

  const entry = marketDataByCompany[parsedCompanyId.value];

  if (!entry) {
    return res.status(404).json({
      message: 'Dados de mercado não encontrados para esta empresa.'
    });
  }

  return res.status(200).json(entry);
});

app.get('/market-data/:companyId/wacc-inputs', (req, res) => {
  const parsedCompanyId = parseCompanyIdParam(req.params.companyId);
  if (parsedCompanyId.error) {
    return res.status(400).json({ message: parsedCompanyId.error });
  }

  const entry = marketDataByCompany[parsedCompanyId.value];
  if (!entry) {
    return res.status(404).json({
      message: 'Dados de mercado não encontrados para esta empresa.'
    });
  }

  return res.status(200).json(buildWaccInputs(entry));
});

app.post('/market-data', (req, res) => {
  const normalized = validateAndNormalizeMarketData(req.body);

  if (normalized.error) {
    return res.status(400).json({ message: normalized.error });
  }

  const { companyId } = normalized.value;

  if (marketDataByCompany[companyId]) {
    return res.status(409).json({
      message: 'Já existem dados de mercado cadastrados para esta empresa. Use PUT para atualizar.'
    });
  }

  marketDataByCompany[companyId] = normalized.value;
  return res.status(201).json(normalized.value);
});

app.put('/market-data/:companyId', (req, res) => {
  const parsedCompanyId = parseCompanyIdParam(req.params.companyId);
  if (parsedCompanyId.error) {
    return res.status(400).json({ message: parsedCompanyId.error });
  }

  const companyId = parsedCompanyId.value;

  if (!marketDataByCompany[companyId]) {
    return res.status(404).json({
      message: 'Dados de mercado não encontrados para esta empresa.'
    });
  }

  const normalized = validateAndNormalizeMarketData(req.body, { forcedCompanyId: companyId });

  if (normalized.error) {
    return res.status(400).json({ message: normalized.error });
  }

  marketDataByCompany[companyId] = normalized.value;
  return res.status(200).json(normalized.value);
});

app.delete('/market-data/:companyId', (req, res) => {
  const parsedCompanyId = parseCompanyIdParam(req.params.companyId);
  if (parsedCompanyId.error) {
    return res.status(400).json({ message: parsedCompanyId.error });
  }

  const companyId = parsedCompanyId.value;

  if (!marketDataByCompany[companyId]) {
    return res.status(404).json({
      message: 'Dados de mercado não encontrados para esta empresa.'
    });
  }

  delete marketDataByCompany[companyId];
  return res.status(204).send();
});

app.listen(PORT, () => {
  console.log(`Microsserviço Market Data ativo na porta ${PORT}`);
});
