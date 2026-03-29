import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import './App.css';

function App() {
  const API_BASE_URL = '/api';
  const MARKET_DATA_API_BASE_URL = '/api-market-data';

  const [assumptions, setAssumptions] = useState({
    taxRate: 25,
    discountRate: 12,
    perpetualGrowthRate: 3,
    evEbitdaMultiple: 7,
    transactionDate: '12/31/17',
    fiscalYearEnd: '6/30/18',
    currentPrice: 25,
    sharesOutstanding: 20000,
    debt: 30000,
    cash: 239550,
    capex: 15000
  });

  const cashFlow = [17747, 37715, 41501, 43510, 47008];
  const years = ['Ano 1', 'Ano 2', 'Ano 3', 'Ano 4', 'Ano 5'];

  const [companies, setCompanies] = useState([]);
  const [companyForm, setCompanyForm] = useState({
    name: '',
    ticker: '',
    sector: ''
  });
  const [companyLoading, setCompanyLoading] = useState(false);
  const [companyError, setCompanyError] = useState('');
  const [companySuccess, setCompanySuccess] = useState('');
  const [marketDataList, setMarketDataList] = useState([]);
  const [marketDataForm, setMarketDataForm] = useState({
    companyId: '',
    cash: '',
    netDebt: '',
    sharesOutstanding: ''
  });
  const [marketDataLoading, setMarketDataLoading] = useState(false);
  const [marketDataError, setMarketDataError] = useState('');
  const [marketDataSuccess, setMarketDataSuccess] = useState('');

  // Cálculo simples testes
  const summary = useMemo(() => {
    const exitValue = 542129;
    const equityValue = exitValue - assumptions.debt + assumptions.cash;
    const intrinsicPerShare = (
      equityValue / assumptions.sharesOutstanding
    ).toFixed(2);

    const marketPerShare = Number(assumptions.currentPrice).toFixed(2);
    const upside = (Number(intrinsicPerShare) - Number(marketPerShare)).toFixed(2);

    return {
      exitValue,
      equityValue,
      intrinsicPerShare,
      marketPerShare,
      upside
    };
  }, [assumptions]);

  const handleAssumptionChange = (event) => {
    const { name, value } = event.target;
    setAssumptions((prev) => ({
      ...prev,
      [name]: name.includes('Date') || name.includes('End') ? value : Number(value) || 0
    }));
  };

  const loadCompanies = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/empresas`);
      setCompanies(response.data);
    } catch {
      setCompanyError('Não foi possível carregar as empresas.Microsserviço pode não estar ativo.');
    }
  };

  const loadMarketData = async () => {
    try {
      const response = await axios.get(`${MARKET_DATA_API_BASE_URL}/market-data`);
      const sorted = [...response.data].sort((a, b) => a.companyId - b.companyId);
      setMarketDataList(sorted);
    } catch {
      setMarketDataError('Não foi possível carregar o Market Data. Verifique se o microsserviço está ativo.');
    }
  };

  useEffect(() => {
    loadCompanies();
    loadMarketData();
  }, []);

  useEffect(() => {
    if (companies.length > 0 && !marketDataForm.companyId) {
      setMarketDataForm((prev) => ({
        ...prev,
        companyId: String(companies[0].id)
      }));
    }
  }, [companies, marketDataForm.companyId]);

  const handleCompanyChange = (event) => {
    const { name, value } = event.target;
    setCompanyForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleCompanySubmit = async (event) => {
    event.preventDefault();
    setCompanyLoading(true);
    setCompanyError('');
    setCompanySuccess('');

    try {
      const payload = {
        name: companyForm.name.trim(),
        ticker: companyForm.ticker.trim().toUpperCase(),
        sector: companyForm.sector.trim()
      };

      const response = await axios.post(`${API_BASE_URL}/empresas`, payload);
      setCompanies((prev) => [...prev, response.data]);
      setCompanyForm({ name: '', ticker: '', sector: '' });
      setCompanySuccess('Empresa cadastrada com sucesso.');
    } catch (error) {
      const message = error?.response?.data?.message
        || 'Erro ao cadastrar empresa. Verifique se o microsserviço está ativo.';
      setCompanyError(message);
    } finally {
      setCompanyLoading(false);
    }
  };

  const handleCompanyDelete = async (id) => {
    setCompanyError('');
    setCompanySuccess('');

    try {
      await axios.delete(`${API_BASE_URL}/empresas/${id}`);
      setCompanies((prev) => prev.filter((company) => company.id !== id));
      setCompanySuccess('Empresa removida com sucesso.');
    } catch (error) {
      const message = error?.response?.data?.message || 'Erro ao remover empresa.';
      setCompanyError(message);
    }
  };

  const handleMarketDataChange = (event) => {
    const { name, value } = event.target;
    setMarketDataForm((prev) => ({
      ...prev,
      [name]: value
    }));
  };

  const resetMarketDataForm = () => {
    setMarketDataForm({
      companyId: companies.length > 0 ? String(companies[0].id) : '',
      cash: '',
      netDebt: '',
      sharesOutstanding: ''
    });
  };

  const handleMarketDataSubmit = async (event) => {
    event.preventDefault();

    const companyId = Number(marketDataForm.companyId);
    const payload = {
      companyId,
      cash: Number(marketDataForm.cash),
      netDebt: Number(marketDataForm.netDebt),
      sharesOutstanding: Number(marketDataForm.sharesOutstanding)
    };

    if (!companyId) {
      setMarketDataError('Selecione uma empresa para salvar o Market Data.');
      return;
    }

    setMarketDataLoading(true);
    setMarketDataError('');
    setMarketDataSuccess('');

    try {
      const response = await axios.post(`${MARKET_DATA_API_BASE_URL}/market-data`, payload);

      setMarketDataList((prev) => {
        const withoutCurrent = prev.filter((entry) => entry.companyId !== response.data.companyId);
        return [...withoutCurrent, response.data].sort((a, b) => a.companyId - b.companyId);
      });

      setMarketDataSuccess('Dados de mercado cadastrados com sucesso.');
      resetMarketDataForm();
    } catch (error) {
      const message = error?.response?.data?.message || 'Erro ao salvar dados de mercado.';
      setMarketDataError(message);
    } finally {
      setMarketDataLoading(false);
    }
  };

  const handleMarketDataDelete = async (companyId) => {
    setMarketDataError('');
    setMarketDataSuccess('');

    try {
      await axios.delete(`${MARKET_DATA_API_BASE_URL}/market-data/${companyId}`);
      setMarketDataList((prev) => prev.filter((entry) => entry.companyId !== companyId));
      setMarketDataSuccess('Dados de mercado removidos com sucesso.');
    } catch (error) {
      const message = error?.response?.data?.message || 'Erro ao remover dados de mercado.';
      setMarketDataError(message);
    }
  };

  const findCompanyLabel = (companyId) => {
    const company = companies.find((item) => item.id === companyId);
    if (!company) {
      return `Empresa #${companyId}`;
    }
    return `${company.name} (${company.ticker})`;
  };

  const maxCash = Math.max(...cashFlow);
  const intrinsicDown = Number(summary.intrinsicPerShare) < Number(summary.marketPerShare);
  const marketDown = Number(summary.marketPerShare) < Number(summary.intrinsicPerShare);
  const upsideDown = Number(summary.upside) < 0;

  const formatNumber = (value) => Number(value).toLocaleString('pt-BR');
  const formatMoney = (value) => Number(value).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });

  return (
    <main className="dcf-page">
      <header className="top-header">
        <div className="brand">Decision DCF - Plataforma de Valuation</div>
        <div className="brand right">2026</div>
      </header>

      <div className="title-strip">Modelo FCD</div>

      <section className="top-grid">
        <article className="panel assumptions">
          <h2>Premissas</h2>

          <div className="assumption-list">
            <label>
              <span>Taxa de Imposto</span>
              <input name="taxRate" type="number" value={assumptions.taxRate} onChange={handleAssumptionChange} />
            </label>
            <label>
              <span>Taxa de Desconto - WACC</span>
              <input name="discountRate" type="number" value={assumptions.discountRate} onChange={handleAssumptionChange} />
            </label>
            <label>
              <span>Taxa de Crescimento Perpétuo</span>
              <input name="perpetualGrowthRate" type="number" value={assumptions.perpetualGrowthRate} onChange={handleAssumptionChange} />
            </label>
            <label>
              <span>Múltiplo EV/EBITDA</span>
              <input name="evEbitdaMultiple" type="number" value={assumptions.evEbitdaMultiple} onChange={handleAssumptionChange} />
            </label>
            <label>
              <span>Data da Transação</span>
              <input name="transactionDate" value={assumptions.transactionDate} onChange={handleAssumptionChange} />
            </label>
            <label>
              <span>Fim do Ano Fiscal</span>
              <input name="fiscalYearEnd" value={assumptions.fiscalYearEnd} onChange={handleAssumptionChange} />
            </label>
            <label>
              <span>Preço Atual</span>
              <input name="currentPrice" type="number" value={assumptions.currentPrice} onChange={handleAssumptionChange} />
            </label>
            <label>
              <span>Ações em Circulação</span>
              <input name="sharesOutstanding" type="number" value={assumptions.sharesOutstanding} onChange={handleAssumptionChange} />
            </label>
            <label>
              <span>Dívida</span>
              <input name="debt" type="number" value={assumptions.debt} onChange={handleAssumptionChange} />
            </label>
            <label>
              <span>Caixa</span>
              <input name="cash" type="number" value={assumptions.cash} onChange={handleAssumptionChange} />
            </label>
            <label>
              <span>Capex</span>
              <input name="capex" type="number" value={assumptions.capex} onChange={handleAssumptionChange} />
            </label>
          </div>
        </article>

        <article className="panel chart-panel">
          <h2>Fluxo de Caixa</h2>
          <div className="bar-chart">
            {cashFlow.map((value, index) => (
              <div className="bar-item" key={years[index]}>
                <div className="bar-value">R$ {formatNumber(value)}</div>
                <div
                  className="bar"
                  style={{ height: `${(value / maxCash) * 140 + 20}px` }}
                />
                <div className="bar-label">{years[index]}</div>
              </div>
            ))}
          </div>
        </article>

        <article className="panel chart-panel">
          <h2>Valor de Mercado vs Valor Intrínseco</h2>
          <div className="bar-chart small">
            {[summary.marketPerShare, summary.upside, summary.intrinsicPerShare].map((value, index) => (
              <div className="bar-item" key={index}>
                <div className="bar-value">R$ {formatMoney(value)}</div>
                <div
                  className="bar"
                  style={{ height: `${(Number(value) / Number(summary.intrinsicPerShare || 1)) * 140 + 20}px` }}
                />
                <div className="bar-label">
                  {index === 0 ? 'Valor de Mercado' : index === 1 ? 'Potencial de Alta' : 'Valor Intrínseco'}
                </div>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="table-section">
        <h2>Fluxo de Caixa Descontado</h2>
        <table>
          <thead>
            <tr>
              <th>Entrada</th>
              <th>Ano 1</th>
              <th>Ano 2</th>
              <th>Ano 3</th>
              <th>Ano 4</th>
              <th>Ano 5</th>
              <th>Saída</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>FCL não alavancado</td>
              <td>35.494</td>
              <td>37.715</td>
              <td>41.501</td>
              <td>43.510</td>
              <td>47.008</td>
              <td>-</td>
            </tr>
            <tr>
              <td>FC da Transação</td>
              <td>17.747</td>
              <td>37.715</td>
              <td>41.501</td>
              <td>43.510</td>
              <td>47.008</td>
              <td>{formatNumber(summary.exitValue)}</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section className="valuation-box-wrap">
        <article className="panel valuation-box">
          <h3>Caminho do Valuation</h3>

          <div className="valuation-row">
            <span>Enterprise Value:</span>
            <strong>R$ {formatNumber(summary.exitValue)}</strong>
          </div>
          <div className="valuation-row">
            <span>(-) Dívida:</span>
            <strong>R$ {formatNumber(assumptions.debt)}</strong>
          </div>
          <div className="valuation-row">
            <span>(+) Caixa:</span>
            <strong>R$ {formatNumber(assumptions.cash)}</strong>
          </div>
          <div className="valuation-row total">
            <span>= Equity Value:</span>
            <strong>R$ {formatNumber(summary.equityValue)}</strong>
          </div>
          <div className="valuation-row">
            <span>/ Ações:</span>
            <strong>{Number(assumptions.sharesOutstanding).toLocaleString('pt-BR')}</strong>
          </div>
          <div className="valuation-row total final">
            <span>= Preço Justo:</span>
            <strong>R$ {formatMoney(summary.intrinsicPerShare)}</strong>
          </div>
        </article>

        <div className="summary-grid">
          <article className="panel mini">
            <h3>Valor Intrínseco</h3>
            <p>Valor patrimonial/ação</p>
            <div className="mini-main">
              <span className={`trend ${intrinsicDown ? 'caiu' : 'subiu'}`}>
                {intrinsicDown ? '↓' : '↑'}
              </span>
              <strong>R$ {formatMoney(summary.intrinsicPerShare)}</strong>
            </div>
          </article>

          <article className="panel mini">
            <h3>Valor de Mercado</h3>
            <p>Valor patrimonial/ação</p>
            <div className="mini-main">
              <span className={`trend ${marketDown ? 'caiu' : 'subiu'}`}>
                {marketDown ? '↓' : '↑'}
              </span>
              <strong>R$ {formatMoney(summary.marketPerShare)}</strong>
            </div>
          </article>

          <article className="panel mini">
            <h3>Taxa de Retorno - Upside(%)</h3>
            <p>Potencial de Alta do Preço-Alvo</p>
            <div className="mini-main">
              <span className={`trend ${upsideDown ? 'caiu' : 'subiu'}`}>
                {upsideDown ? '↓' : '↑'}
              </span>
              <strong>{formatMoney(summary.upside)}</strong>
            </div>
          </article>
        </div>
      </section>

      <section className="company-section">
        <article className="panel company-panel">
          <h2>Catálogo de Empresas</h2>

          <form className="company-form" onSubmit={handleCompanySubmit}>
            <input
              name="name"
              placeholder="Nome da empresa"
              value={companyForm.name}
              onChange={handleCompanyChange}
              required
            />
            <input
              name="ticker"
              placeholder="Ticker"
              value={companyForm.ticker}
              onChange={handleCompanyChange}
              required
            />
            <input
              name="sector"
              placeholder="Setor"
              value={companyForm.sector}
              onChange={handleCompanyChange}
              required
            />
            <button type="submit" disabled={companyLoading}>
              {companyLoading ? 'Salvando...' : 'Cadastrar empresa'}
            </button>
          </form>

          {companyError && <p className="feedback error">{companyError}</p>}
          {companySuccess && <p className="feedback success">{companySuccess}</p>}

          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Nome</th>
                <th>Ticker</th>
                <th>Setor</th>
                <th className="action-cell"></th>
              </tr>
            </thead>
            <tbody>
              {companies.length === 0 ? (
                <tr>
                  <td colSpan="5">Sem empresas cadastradas.</td>
                </tr>
              ) : (
                companies.map((company) => (
                  <tr key={company.id}>
                    <td>{company.id}</td>
                    <td>{company.name}</td>
                    <td>{company.ticker}</td>
                    <td>{company.sector}</td>
                    <td className="action-cell">
                      <button
                        type="button"
                        className="delete-company-btn"
                        onClick={() => handleCompanyDelete(company.id)}
                        title="Remover empresa"
                        aria-label={`Remover ${company.name}`}
                      >
                        ×
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </article>

        <article className="panel company-panel">
          <h2>Market Data</h2>

          <form className="market-form" onSubmit={handleMarketDataSubmit}>
            <select
              name="companyId"
              value={marketDataForm.companyId}
              onChange={handleMarketDataChange}
              required
            >
              {companies.length === 0 ? (
                <option value="">Cadastre uma empresa primeiro</option>
              ) : (
                companies.map((company) => (
                  <option key={company.id} value={company.id}>
                    {company.name} ({company.ticker})
                  </option>
                ))
              )}
            </select>

            <input
              name="cash"
              type="number"
              min="0"
              step="any"
              placeholder="Caixa"
              value={marketDataForm.cash}
              onChange={handleMarketDataChange}
              required
            />

            <input
              name="netDebt"
              type="number"
              min="0"
              step="any"
              placeholder="Dívida líquida"
              value={marketDataForm.netDebt}
              onChange={handleMarketDataChange}
              required
            />

            <input
              name="sharesOutstanding"
              type="number"
              min="0"
              step="1"
              placeholder="Ações emitidas"
              value={marketDataForm.sharesOutstanding}
              onChange={handleMarketDataChange}
              required
            />

            <div className="inline-actions">
              <button type="submit" disabled={marketDataLoading || companies.length === 0}>
                {marketDataLoading ? 'Salvando...' : 'Cadastrar dados'}
              </button>
            </div>
          </form>

          {marketDataError && <p className="feedback error">{marketDataError}</p>}
          {marketDataSuccess && <p className="feedback success">{marketDataSuccess}</p>}

          <table>
            <thead>
              <tr>
                <th>Empresa</th>
                <th>Caixa</th>
                <th>Dívida Líquida</th>
                <th>Ações Emitidas</th>
                <th>Atualizado em</th>
                <th className="action-cell"></th>
              </tr>
            </thead>
            <tbody>
              {marketDataList.length === 0 ? (
                <tr>
                  <td colSpan="6">Sem dados de mercado cadastrados.</td>
                </tr>
              ) : (
                marketDataList.map((entry) => (
                  <tr key={entry.companyId}>
                    <td>{findCompanyLabel(entry.companyId)}</td>
                    <td>{formatNumber(entry.cash)}</td>
                    <td>{formatNumber(entry.netDebt)}</td>
                    <td>{formatNumber(entry.sharesOutstanding)}</td>
                    <td>{new Date(entry.updatedAt).toLocaleString('pt-BR')}</td>
                    <td className="action-cell">
                      <button
                        type="button"
                        className="delete-company-btn"
                        onClick={() => handleMarketDataDelete(entry.companyId)}
                        title="Remover dados de mercado"
                        aria-label={`Remover dados de ${findCompanyLabel(entry.companyId)}`}
                      >
                        ×
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </article>
      </section>
    </main>
  );
}

export default App;