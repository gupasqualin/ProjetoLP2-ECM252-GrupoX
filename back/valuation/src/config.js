function sanitizeRate(value, fallback) {
  const numberValue = Number(value ?? fallback);
  return Number.isFinite(numberValue) && numberValue >= 0 && numberValue < 1 ? numberValue : fallback;
}

function nowIso() {
  return new Date().toISOString();
}

const PORT = process.env.PORT || 3004;
// Unica comunicacao com o resto do sistema: o barramento de eventos.
const EVENT_BUS_URL = process.env.EVENT_BUS_URL || 'http://localhost:3006';
// Endereco em que o barramento entrega os eventos para este servico.
const EVENTS_URL = process.env.EVENTS_URL || `http://localhost:${PORT}/events`;

const DEFAULT_RISK_FREE_RATE = sanitizeRate(process.env.DEFAULT_RISK_FREE_RATE, 0.045);
const DEFAULT_MARKET_RISK_PREMIUM = sanitizeRate(process.env.DEFAULT_MARKET_RISK_PREMIUM, 0.055);

export {
  PORT,
  EVENT_BUS_URL,
  EVENTS_URL,
  DEFAULT_RISK_FREE_RATE,
  DEFAULT_MARKET_RISK_PREMIUM,
  sanitizeRate,
  nowIso
};
