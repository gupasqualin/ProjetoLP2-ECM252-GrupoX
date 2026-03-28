import express from 'express';
import cors from 'cors';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Armazenamento simples em memória (ideal para a primeira versão do microsserviço).
let companies = [
  { id: 1, name: 'WEG S.A.', ticker: 'WEGE3', sector: 'Bens Industriais' },
  { id: 2, name: 'Petrobras', ticker: 'PETR4', sector: 'Energia' }
];

let nextId = companies.length + 1;

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
  return res.status(201).json(newCompany);
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
  return res.status(204).send();
});

app.listen(PORT, () => {
  console.log(`Microsserviço Gestão de Empresas ativo na porta ${PORT}`);
});
