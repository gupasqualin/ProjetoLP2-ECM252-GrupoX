import express from 'express';
import cors from 'cors';

import { PORT, EVENT_BUS_URL, EVENTS_URL } from './config.js';
import { applyEvent, EVENT_TYPES } from './events.js';
import { criarAssinatura } from './assinatura-eventos.js';
import { buildStateSnapshot, state } from './state.js';
import { parseCompanyId } from './validacao.js';
import { calculateValuation } from './calculos.js';

const app = express();

// Os dados de empresas, mercado e premissas chegam so pelos eventos do
// barramento; este servico nunca chama outro microsservico diretamente.
const assinatura = criarAssinatura({
  nome: 'valuation',
  eventBusUrl: EVENT_BUS_URL,
  urlDeEventos: EVENTS_URL,
  tipos: EVENT_TYPES,
  aplicar: applyEvent
});

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
    const result = assinatura.receber(events[index]);
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
      message: 'Valuation ainda nao calculado para esta empresa. Use POST /valuation/:companyId/recalculate.'
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

app.listen(PORT, () => {
  console.log(`Microsservico Valuation ativo na porta ${PORT}`);
  assinatura.iniciar();
});
