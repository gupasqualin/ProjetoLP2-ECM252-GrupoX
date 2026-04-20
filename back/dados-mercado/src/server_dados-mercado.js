import express from 'express';
import cors from 'cors';

const app = express();
const PORT = process.env.PORT || 3002;
const EVENT_BUS_URL = process.env.EVENT_BUS_URL || 'http://localhost:3006';

function publishEvent(eventType, data = {}) {
  fetch(`${EVENT_BUS_URL}/publish`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ eventType, ...data })
  }).catch((error) => {
    console.warn(`[event-bus] Falha ao publicar ${eventType}:`, error.message);
  });
}

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

let marketDataByCompany = {};

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
  res.status(201).json(normalized.value);
  publishEvent('MARKET_DATA_UPSERTED', { payload: normalized.value });
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
  res.status(200).json(normalized.value);
  publishEvent('MARKET_DATA_UPSERTED', { payload: normalized.value });
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
  res.status(204).send();
  publishEvent('MARKET_DATA_DELETED', { companyId });
});

app.listen(PORT, () => {
  console.log(`Microsserviço Market Data ativo na porta ${PORT}`);
});
