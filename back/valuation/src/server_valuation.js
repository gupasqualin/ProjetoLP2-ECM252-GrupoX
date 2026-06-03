import express from 'express';
import cors from 'cors';

import {
  PORT,
  COMPANY_SERVICE_URL,
  MARKET_DATA_SERVICE_URL,
  ASSUMPTIONS_SERVICE_URL
} from './config.js';
import { applyEvent, EVENT_TYPES } from './events.js';
import { fetchJsonOrFail } from './http.js';
import { buildStateSnapshot, ensureCompanyStub, state } from './state.js';
import {
  parseCompanyId,
  validateAssumptions,
  validateCompany,
  validateMarketData
} from './validacao.js';
import { calculateValuation } from './calculos.js';

const app = express();

app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => {
  res.status(200).json({
    service: 'ms-valuation',
    status: 'ok',
    counters: {
      companies: Object.keys(state.companiesById).length,
      marketData: Object.keys(state.marketDataByCompany).length,
      assumptions: Object.keys(state.assumptionsByCompany).length,
      valuations: Object.keys(state.valuationsByCompany).length
    }
  });
});

app.get('/events/types', (req, res) => {
  res.status(200).json({ eventTypes: EVENT_TYPES });
});

app.post('/events', (req, res) => {
  const events = Array.isArray(req.body) ? req.body : [req.body];
  if (events.length === 0) {
    return res.status(400).json({ message: 'Nenhum evento enviado.' });
  }

  const applied = [];
  for (let index = 0; index < events.length; index += 1) {
    const result = applyEvent(events[index]);
    if (result.error) {
      return res.status(400).json({
        message: result.error,
        failedAtIndex: index,
        appliedCount: applied.length
      });
    }
    applied.push(result.value);
  }

  return res.status(202).json({ message: 'Eventos processados com sucesso.', applied });
});

app.get('/state', (req, res) => {
  return res.status(200).json(buildStateSnapshot());
});

app.get('/valuations', (req, res) => {
  const list = Object.values(state.valuationsByCompany).sort((a, b) => a.companyId - b.companyId);
  return res.status(200).json(list);
});

app.get('/valuation/:companyId', (req, res) => {
  const companyIdResult = parseCompanyId(req.params.companyId);
  if (companyIdResult.error) {
    return res.status(400).json({ message: companyIdResult.error });
  }

  const cached = state.valuationsByCompany[companyIdResult.value];
  if (!cached) {
    return res.status(404).json({
      message: 'Valuation ainda nao calculado para esta empresa. Use /valuation/:companyId/recalculate ou /valuation/:companyId/sync-from-services.'
    });
  }

  return res.status(200).json(cached);
});

app.post('/valuation/:companyId/recalculate', (req, res) => {
  const companyIdResult = parseCompanyId(req.params.companyId);
  if (companyIdResult.error) {
    return res.status(400).json({ message: companyIdResult.error });
  }

  const result = calculateValuation(companyIdResult.value);
  if (result.error) {
    return res.status(404).json({ message: result.error });
  }

  return res.status(200).json(result.value);
});

app.post('/valuation/recalculate-all', (req, res) => {
  const companyIds = Object.keys(state.companiesById).map(Number).sort((a, b) => a - b);
  const computed = [];
  const skipped = [];

  for (const companyId of companyIds) {
    const result = calculateValuation(companyId);
    if (result.error) {
      skipped.push({ companyId, reason: result.error });
      continue;
    }

    computed.push({
      companyId,
      enterpriseValue: result.value.valuation.enterpriseValue,
      equityValue: result.value.valuation.equityValue,
      fairValuePerShare: result.value.valuation.fairValuePerShare
    });
  }

  return res.status(200).json({
    computedCount: computed.length,
    skippedCount: skipped.length,
    computed,
    skipped
  });
});

app.post('/valuation/:companyId/sync-from-services', async (req, res) => {
  const companyIdResult = parseCompanyId(req.params.companyId);
  if (companyIdResult.error) {
    return res.status(400).json({ message: companyIdResult.error });
  }

  const companyId = companyIdResult.value;

  try {
    const [marketData, assumptions] = await Promise.all([
      fetchJsonOrFail(`${MARKET_DATA_SERVICE_URL}/market-data/${companyId}`, 'ms-market-data'),
      fetchJsonOrFail(`${ASSUMPTIONS_SERVICE_URL}/premissas/${companyId}`, 'ms-premissas-projecao')
    ]);

    const marketDataNormalized = validateMarketData(marketData, { forcedCompanyId: companyId });
    if (marketDataNormalized.error) {
      return res.status(400).json({ message: marketDataNormalized.error });
    }

    const assumptionsNormalized = validateAssumptions(assumptions, { forcedCompanyId: companyId });
    if (assumptionsNormalized.error) {
      return res.status(400).json({ message: assumptionsNormalized.error });
    }

    state.marketDataByCompany[companyId] = marketDataNormalized.value;
    state.assumptionsByCompany[companyId] = assumptionsNormalized.value;

    try {
      const companies = await fetchJsonOrFail(`${COMPANY_SERVICE_URL}/empresas`, 'ms-gestao-empresas');
      const company = Array.isArray(companies)
        ? companies.find((entry) => Number(entry.id) === companyId)
        : null;

      if (company) {
        const companyNormalized = validateCompany(company);
        if (!companyNormalized.error) {
          state.companiesById[companyId] = companyNormalized.value;
        } else {
          ensureCompanyStub(companyId);
        }
      } else {
        ensureCompanyStub(companyId);
      }
    } catch {
      ensureCompanyStub(companyId);
    }

    const valuation = calculateValuation(companyId);
    if (valuation.error) {
      return res.status(400).json({ message: valuation.error });
    }

    return res.status(200).json({
      message: 'Sincronizacao concluida e valuation calculado com sucesso.',
      valuation: valuation.value
    });
  } catch (error) {
    return res.status(502).json({
      message: `Falha ao sincronizar dados com os outros microsservicos: ${error.message}`
    });
  }
});

app.listen(PORT, () => {
  console.log(`Microsservico Valuation ativo na porta ${PORT}`);
});
