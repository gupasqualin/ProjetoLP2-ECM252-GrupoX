import express from 'express';
import cors from 'cors';

const app = express();
const PORT = process.env.PORT || 3006;

const EVENT_TYPES = [
  'COMPANY_UPSERTED',
  'COMPANY_DELETED',
  'MARKET_DATA_UPSERTED',
  'MARKET_DATA_DELETED',
  'ASSUMPTIONS_UPSERTED',
  'ASSUMPTIONS_DELETED',
  'VALUATION_RECALCULATE_REQUESTED'
];

// Cada microsservico se registra sozinho (POST /subscribe) quando sobe.
const subscribersByEventType = EVENT_TYPES.reduce((accumulator, eventType) => {
  accumulator[eventType] = new Set();
  return accumulator;
}, {});

// Historico de todos os eventos publicados. Um microsservico que estava fora
// do ar recupera o que perdeu com GET /events?after=<ultimo id que recebeu>.
const eventLog = [];
let nextEventId = 1;

app.use(cors());
app.use(express.json());

function normalizeEventType(value) {
  return String(value || '').trim().toUpperCase();
}

function normalizeUrl(value) {
  return String(value || '').trim();
}

function isValidEventType(eventType) {
  return EVENT_TYPES.includes(eventType);
}

function isValidUrl(value) {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function serializeSubscribers() {
  const serialized = {};

  for (const eventType of EVENT_TYPES) {
    serialized[eventType] = Array.from(subscribersByEventType[eventType]);
  }

  return serialized;
}

app.get('/health', (req, res) => {
  res.status(200).json({
    service: 'ms-barramento-eventos',
    status: 'ok',
    storedEvents: eventLog.length,
    subscribers: serializeSubscribers()
  });
});

app.get('/events', (req, res) => {
  const after = Number(req.query.after ?? 0);
  if (!Number.isInteger(after) || after < 0) {
    return res.status(400).json({ message: 'after deve ser um inteiro maior ou igual a 0.' });
  }

  const typesFilter = String(req.query.types || '')
    .split(',')
    .map(normalizeEventType)
    .filter(Boolean);

  const events = eventLog.filter(
    (event) => event.id > after && (typesFilter.length === 0 || typesFilter.includes(event.eventType))
  );

  return res.status(200).json({ lastEventId: nextEventId - 1, events });
});

app.get('/subscribers', (req, res) => {
  res.status(200).json({
    eventTypes: EVENT_TYPES,
    subscribers: serializeSubscribers()
  });
});

app.post('/subscribe', (req, res) => {
  const eventType = normalizeEventType(req.body?.eventType);
  const url = normalizeUrl(req.body?.url);

  if (!isValidEventType(eventType)) {
    return res.status(400).json({
      message: `eventType invalido. Tipos permitidos: ${EVENT_TYPES.join(', ')}`
    });
  }

  if (!isValidUrl(url)) {
    return res.status(400).json({
      message: 'url invalida. Informe uma URL HTTP/HTTPS valida.'
    });
  }

  const alreadySubscribed = subscribersByEventType[eventType].has(url);
  subscribersByEventType[eventType].add(url);

  console.log(`[barramento-eventos] Subscriber registrado: ${eventType} -> ${url}`);

  return res.status(alreadySubscribed ? 200 : 201).json({
    message: alreadySubscribed
      ? 'Subscriber ja estava registrado.'
      : 'Subscriber registrado com sucesso.',
    eventType,
    url,
    totalSubscribers: subscribersByEventType[eventType].size
  });
});

app.delete('/subscribe', (req, res) => {
  const eventType = normalizeEventType(req.body?.eventType);
  const url = normalizeUrl(req.body?.url);

  if (!isValidEventType(eventType)) {
    return res.status(400).json({
      message: `eventType invalido. Tipos permitidos: ${EVENT_TYPES.join(', ')}`
    });
  }

  if (!url) {
    return res.status(400).json({
      message: 'url e obrigatoria para remover um subscriber.'
    });
  }

  const removed = subscribersByEventType[eventType].delete(url);

  if (!removed) {
    return res.status(404).json({
      message: 'Subscriber nao encontrado para este eventType.',
      eventType,
      url
    });
  }

  console.log(`[barramento-eventos] Subscriber removido: ${eventType} -> ${url}`);

  return res.status(200).json({
    message: 'Subscriber removido com sucesso.',
    eventType,
    url,
    totalSubscribers: subscribersByEventType[eventType].size
  });
});

app.post('/publish', async (req, res) => {
  const eventType = normalizeEventType(req.body?.eventType);

  if (!isValidEventType(eventType)) {
    return res.status(400).json({
      message: `eventType invalido. Tipos permitidos: ${EVENT_TYPES.join(', ')}`
    });
  }

  const eventPayload = { id: nextEventId, eventType };
  nextEventId += 1;

  if (req.body?.payload !== undefined) {
    eventPayload.payload = req.body.payload;
  }

  if (req.body?.companyId !== undefined) {
    eventPayload.companyId = req.body.companyId;
  }

  eventPayload.publishedAt = new Date().toISOString();
  eventLog.push(eventPayload);

  const subscribers = Array.from(subscribersByEventType[eventType]);
  const failures = [];
  let notifiedCount = 0;

  console.log(
    `[barramento-eventos] Publicando evento ${eventType} para ${subscribers.length} subscriber(s):`,
    JSON.stringify(eventPayload)
  );

  await Promise.all(
    subscribers.map(async (url) => {
      try {
        console.log(`[barramento-eventos] Entregando ${eventType} para ${url}`);

        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(eventPayload)
        });

        if (!response.ok) {
          let reason = `HTTP ${response.status}`;

          try {
            const body = await response.json();
            if (body?.message) {
              reason = `HTTP ${response.status} - ${body.message}`;
            }
          } catch {
            reason = `HTTP ${response.status}`;
          }

          failures.push({ url, reason });
          console.warn(`[barramento-eventos] Falha na entrega ${eventType} -> ${url}: ${reason}`);
          return;
        }

        notifiedCount += 1;
        console.log(`[barramento-eventos] Entrega concluida ${eventType} -> ${url}`);
      } catch (error) {
        failures.push({ url, reason: error.message });
        console.warn(`[barramento-eventos] Falha na entrega ${eventType} -> ${url}: ${error.message}`);
      }
    })
  );

  return res.status(200).json({
    eventId: eventPayload.id,
    eventType,
    totalSubscribers: subscribers.length,
    notifiedCount,
    failedCount: failures.length,
    failures
  });
});

app.listen(PORT, () => {
  console.log(`Microsservico Barramento de Eventos ativo na porta ${PORT}`);
});
