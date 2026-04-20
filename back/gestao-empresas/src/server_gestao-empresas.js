import express from 'express';
import cors from 'cors';

const app = express();
const PORT = process.env.PORT || 3001;
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

let companies = [];

let nextId = 1;

app.get('/health', (req, res) => {
  res.status(200).json({
    service: 'ms-gestao-empresas',
    status: 'ok'
  });
});

app.get('/empresas', (req, res) => {
  res.status(200).json(companies);
});

app.post('/empresas', (req, res) => {
  const { name, ticker, sector } = req.body;

  if (!name || !ticker || !sector) {
    return res.status(400).json({
      message: 'Campos obrigatórios: name, ticker e sector.'
    });
  }

  const alreadyExists = companies.some(
    (company) => company.ticker.toUpperCase() === String(ticker).toUpperCase()
  );

  if (alreadyExists) {
    return res.status(409).json({
      message: 'Já existe uma empresa cadastrada com esse ticker.'
    });
  }

  const newCompany = {
    id: nextId++,
    name: String(name).trim(),
    ticker: String(ticker).trim().toUpperCase(),
    sector: String(sector).trim()
  };

  companies.push(newCompany);
  res.status(201).json(newCompany);
  publishEvent('COMPANY_UPSERTED', { payload: newCompany });
});

app.delete('/empresas/:id', (req, res) => {
  const id = Number(req.params.id);
  const exists = companies.some((company) => company.id === id);

  if (!exists) {
    return res.status(404).json({
      message: 'Empresa não encontrada.'
    });
  }

  companies = companies.filter((company) => company.id !== id);
  res.status(204).send();
  publishEvent('COMPANY_DELETED', { companyId: id });
});

app.listen(PORT, () => {
  console.log(`Microsserviço Gestão de Empresas ativo na porta ${PORT}`);
});
