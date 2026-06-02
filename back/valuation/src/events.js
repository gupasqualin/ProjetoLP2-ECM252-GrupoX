import { calculateValuation } from './calculos.js';
import { ensureCompanyStub, state } from './state.js';
import {
  parseCompanyId,
  validateAssumptions,
  validateCompany,
  validateMarketData
} from './validacao.js';

const EVENT_TYPES = [
  'COMPANY_UPSERTED',
  'COMPANY_DELETED',
  'MARKET_DATA_UPSERTED',
  'MARKET_DATA_DELETED',
  'ASSUMPTIONS_UPSERTED',
  'ASSUMPTIONS_DELETED',
  'VALUATION_RECALCULATE_REQUESTED'
];

function applyEvent(event) {
  if (!event || typeof event !== 'object') {
    return { error: 'Evento invalido.' };
  }

  const eventType = String(event.eventType || '').trim().toUpperCase();
  if (!EVENT_TYPES.includes(eventType)) {
    return { error: `eventType invalido. Tipos permitidos: ${EVENT_TYPES.join(', ')}` };
  }

  const handlers = {
    COMPANY_UPSERTED: () => {
      const normalized = validateCompany(event.payload);
      if (normalized.error) return { error: normalized.error };
      state.companiesById[normalized.value.id] = normalized.value;
      return { value: { eventType, companyId: normalized.value.id } };
    },
        COMPANY_DELETED: () => {
        const idResult = parseCompanyId(event.companyId);
        if (idResult.error) return { error: idResult.error };
        const companyId = idResult.value;
        delete state.companiesById[companyId];
        delete state.marketDataByCompany[companyId];
        delete state.assumptionsByCompany[companyId];
        delete state.valuationsByCompany[companyId];
        return { value: { eventType, companyId } };
        },
    MARKET_DATA_UPSERTED: () => {
      const normalized = validateMarketData(event.payload);
      if (normalized.error) return { error: normalized.error };
      ensureCompanyStub(normalized.value.companyId);
      state.marketDataByCompany[normalized.value.companyId] = normalized.value;
      delete state.valuationsByCompany[normalized.value.companyId];
      return { value: { eventType, companyId: normalized.value.companyId } };
    },
        MARKET_DATA_DELETED: () => {
        const idResult = parseCompanyId(event.companyId);
        if (idResult.error) return { error: idResult.error };
        const companyId = idResult.value;
        delete state.marketDataByCompany[companyId];
        delete state.valuationsByCompany[companyId];
        return { value: { eventType, companyId } };
        },
            ASSUMPTIONS_UPSERTED: () => {
            const normalized = validateAssumptions(event.payload);
            if (normalized.error) return { error: normalized.error };
            ensureCompanyStub(normalized.value.companyId);
            state.assumptionsByCompany[normalized.value.companyId] = normalized.value;
            delete state.valuationsByCompany[normalized.value.companyId];
            return { value: { eventType, companyId: normalized.value.companyId } };
            },
    ASSUMPTIONS_DELETED: () => {
      const idResult = parseCompanyId(event.companyId);
      if (idResult.error) return { error: idResult.error };
      const companyId = idResult.value;
      delete state.assumptionsByCompany[companyId];
      delete state.valuationsByCompany[companyId];
      return { value: { eventType, companyId } };
    },
    VALUATION_RECALCULATE_REQUESTED: () => {
      const idResult = parseCompanyId(event.companyId);
      if (idResult.error) return { error: idResult.error };
      const companyId = idResult.value;
      const computed = calculateValuation(companyId);
      return {
        value: {
          eventType,
          companyId,
          recalculated: !computed.error,
          skippedReason: computed.error || null
        }
      };
    }
  };

  return handlers[eventType] ? handlers[eventType]() : { error: 'Evento nao tratado.' };
}

export { EVENT_TYPES, applyEvent };
