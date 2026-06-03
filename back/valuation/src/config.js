function sanitizeRate(value, fallback) {
  const numberValue = Number(value ?? fallback);
  return Number.isFinite(numberValue) && numberValue >= 0 && numberValue < 1 ? numberValue : fallback;
}

function nowIso() {
  return new Date().toISOString();
}

const PORT = process.env.PORT || 3004;
const COMPANY_SERVICE_URL = process.env.COMPANY_SERVICE_URL || 'http://localhost:3001';
const MARKET_DATA_SERVICE_URL = process.env.MARKET_DATA_SERVICE_URL || 'http://localhost:3002';
const ASSUMPTIONS_SERVICE_URL = process.env.ASSUMPTIONS_SERVICE_URL || 'http://localhost:3003';

const DEFAULT_RISK_FREE_RATE = sanitizeRate(process.env.DEFAULT_RISK_FREE_RATE, 0.045);
const DEFAULT_MARKET_RISK_PREMIUM = sanitizeRate(process.env.DEFAULT_MARKET_RISK_PREMIUM, 0.055);

export {
  PORT,
  COMPANY_SERVICE_URL,
  MARKET_DATA_SERVICE_URL,
  ASSUMPTIONS_SERVICE_URL,
  DEFAULT_RISK_FREE_RATE,
  DEFAULT_MARKET_RISK_PREMIUM,
  sanitizeRate,
  nowIso
};
