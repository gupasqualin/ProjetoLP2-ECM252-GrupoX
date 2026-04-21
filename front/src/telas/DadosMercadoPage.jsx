import { useEffect, useState } from 'react';
import axios from 'axios';

const API_BASE_URL = '/api';
const MARKET_DATA_API_BASE_URL = '/api-market-data';

const initialMarketDataForm = {
  companyId: '',
  currentStockPrice: '',
  sharesOutstanding: '',
  beta: '',
  totalDebt: '',
  costOfDebt: '',
  effectiveTaxRate: '',
  cash: '',
  netDebt: '',
  revenue: '',
  ebitda: '',
  ebit: '',
  capex: '',
  depreciation: '',
  workingCapital: ''
};

function DadosMercadoPage() {
  const [companies, setCompanies] = useState([]);
  const [marketDataList, setMarketDataList] = useState([]);
  const [marketDataForm, setMarketDataForm] = useState(initialMarketDataForm);
  const [marketDataLoading, setMarketDataLoading] = useState(false);
  const [marketDataError, setMarketDataError] = useState('');
  const [marketDataSuccess, setMarketDataSuccess] = useState('');

  const loadCompanies = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/empresas`);
      setCompanies(response.data);
    } catch {
      setMarketDataError('Nao foi possivel carregar as empresas. Verifique se o microservico esta ativo.');
    }
  };

  const loadMarketData = async () => {
    try {
      const response = await axios.get(`${MARKET_DATA_API_BASE_URL}/market-data`);
      const sorted = [...response.data].sort((a, b) => a.companyId - b.companyId);
      setMarketDataList(sorted);
    } catch {
      setMarketDataError('Nao foi possivel carregar o Market Data. Verifique se o microservico esta ativo.');
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

  const handleMarketDataChange = (event) => {
    const { name, value } = event.target;
    setMarketDataForm((prev) => ({
      ...prev,
      [name]: value
    }));
  };

  const resetMarketDataForm = () => {
    setMarketDataForm({
      ...initialMarketDataForm,
      companyId: companies.length > 0 ? String(companies[0].id) : ''
    });
  };

  const handleMarketDataSubmit = async (event) => {
    event.preventDefault();

    const companyId = Number(marketDataForm.companyId);
    const payload = {
      companyId,
      currentStockPrice: Number(marketDataForm.currentStockPrice),
      sharesOutstanding: Number(marketDataForm.sharesOutstanding),
      beta: Number(marketDataForm.beta),
      totalDebt: Number(marketDataForm.totalDebt),
      costOfDebt: Number(marketDataForm.costOfDebt),
      effectiveTaxRate: Number(marketDataForm.effectiveTaxRate),
      cash: Number(marketDataForm.cash),
      netDebt: Number(marketDataForm.netDebt),
      revenue: Number(marketDataForm.revenue),
      ebitda: Number(marketDataForm.ebitda),
      ebit: Number(marketDataForm.ebit),
      capex: Number(marketDataForm.capex),
      depreciation: Number(marketDataForm.depreciation),
      workingCapital: Number(marketDataForm.workingCapital)
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

  const formatNumber = (value) => {
    const parsedValue = Number(value);
    if (!Number.isFinite(parsedValue)) {
      return '-';
    }
    return parsedValue.toLocaleString('pt-BR');
  };

  const formatMoney = (value) => {
    const parsedValue = Number(value);
    if (!Number.isFinite(parsedValue)) {
      return '-';
    }
    return parsedValue.toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  };

  return (
    <section className="company-section">
      <article className="panel company-panel">
        <h2>Dados de Mercado</h2>

        <form className="market-form" onSubmit={handleMarketDataSubmit}>
          <div className="market-company-field">
            <label htmlFor="companyId">Empresa</label>
            <select
              id="companyId"
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
          </div>

          <div className="market-fieldset-grid">
            <fieldset className="market-fieldset">
              <legend>Precificacao e Risco</legend>

              <div className="market-field">
                <label htmlFor="currentStockPrice">Preco atual da acao</label>
                <input
                  id="currentStockPrice"
                  name="currentStockPrice"
                  type="number"
                  min="0"
                  step="any"
                  placeholder="Preco atual da acao (R$)"
                  value={marketDataForm.currentStockPrice}
                  onChange={handleMarketDataChange}
                  required
                />
              </div>

              <div className="market-field">
                <label htmlFor="sharesOutstanding">Acoes emitidas</label>
                <input
                  id="sharesOutstanding"
                  name="sharesOutstanding"
                  type="number"
                  min="0"
                  step="any"
                  placeholder="Total de acoes emitidas"
                  value={marketDataForm.sharesOutstanding}
                  onChange={handleMarketDataChange}
                  required
                />
              </div>

              <div className="market-field">
                <label htmlFor="beta">Beta</label>
                <input
                  id="beta"
                  name="beta"
                  type="number"
                  min="0"
                  step="any"
                  placeholder="Beta da empresa"
                  value={marketDataForm.beta}
                  onChange={handleMarketDataChange}
                  required
                />
              </div>

              <div className="market-field">
                <label htmlFor="totalDebt">Divida bruta total</label>
                <input
                  id="totalDebt"
                  name="totalDebt"
                  type="number"
                  min="0"
                  step="any"
                  placeholder="Divida bruta total (R$)"
                  value={marketDataForm.totalDebt}
                  onChange={handleMarketDataChange}
                  required
                />
              </div>

              <div className="market-field">
                <label htmlFor="costOfDebt">Custo da divida</label>
                <input
                  id="costOfDebt"
                  name="costOfDebt"
                  type="number"
                  step="any"
                  placeholder="Custo da divida (0 a 1)"
                  value={marketDataForm.costOfDebt}
                  onChange={handleMarketDataChange}
                  required
                />
              </div>

              <div className="market-field">
                <label htmlFor="effectiveTaxRate">Aliquota efetiva de IR</label>
                <input
                  id="effectiveTaxRate"
                  name="effectiveTaxRate"
                  type="number"
                  step="any"
                  placeholder="Aliquota efetiva de IR (0 a 1)"
                  value={marketDataForm.effectiveTaxRate}
                  onChange={handleMarketDataChange}
                  required
                />
              </div>
            </fieldset>

            <fieldset className="market-fieldset">
              <legend>Demonstrativo de Resultados</legend>

              <div className="market-field">
                <label htmlFor="cash">Caixa e equivalentes</label>
                <input
                  id="cash"
                  name="cash"
                  type="number"
                  min="0"
                  step="any"
                  placeholder="Caixa e equivalentes (R$)"
                  value={marketDataForm.cash}
                  onChange={handleMarketDataChange}
                  required
                />
              </div>

              <div className="market-field">
                <label htmlFor="netDebt">Divida liquida</label>
                <input
                  id="netDebt"
                  name="netDebt"
                  type="number"
                  min="0"
                  step="any"
                  placeholder="Divida liquida (R$)"
                  value={marketDataForm.netDebt}
                  onChange={handleMarketDataChange}
                  required
                />
              </div>

              <div className="market-field">
                <label htmlFor="revenue">Receita liquida</label>
                <input
                  id="revenue"
                  name="revenue"
                  type="number"
                  min="0"
                  step="any"
                  placeholder="Receita liquida (R$)"
                  value={marketDataForm.revenue}
                  onChange={handleMarketDataChange}
                  required
                />
              </div>

              <div className="market-field">
                <label htmlFor="ebitda">EBITDA</label>
                <input
                  id="ebitda"
                  name="ebitda"
                  type="number"
                  step="any"
                  placeholder="EBITDA (R$)"
                  value={marketDataForm.ebitda}
                  onChange={handleMarketDataChange}
                  required
                />
              </div>

              <div className="market-field">
                <label htmlFor="ebit">EBIT</label>
                <input
                  id="ebit"
                  name="ebit"
                  type="number"
                  step="any"
                  placeholder="EBIT (R$)"
                  value={marketDataForm.ebit}
                  onChange={handleMarketDataChange}
                  required
                />
              </div>

              <div className="market-field">
                <label htmlFor="capex">Capex</label>
                <input
                  id="capex"
                  name="capex"
                  type="number"
                  min="0"
                  step="any"
                  placeholder="Capex do exercicio (R$)"
                  value={marketDataForm.capex}
                  onChange={handleMarketDataChange}
                  required
                />
              </div>

              <div className="market-field">
                <label htmlFor="depreciation">Depreciacao e amortizacao</label>
                <input
                  id="depreciation"
                  name="depreciation"
                  type="number"
                  min="0"
                  step="any"
                  placeholder="Depreciacao e amortizacao (R$)"
                  value={marketDataForm.depreciation}
                  onChange={handleMarketDataChange}
                  required
                />
              </div>

              <div className="market-field">
                <label htmlFor="workingCapital">Capital de giro liquido</label>
                <input
                  id="workingCapital"
                  name="workingCapital"
                  type="number"
                  step="any"
                  placeholder="Capital de giro liquido (R$)"
                  value={marketDataForm.workingCapital}
                  onChange={handleMarketDataChange}
                  required
                />
              </div>
            </fieldset>
          </div>

          <div className="inline-actions market-actions">
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
              <th>Receita</th>
              <th>EBITDA</th>
              <th>Divida Liquida</th>
              <th>Beta</th>
              <th>Preco Atual</th>
              <th>Atualizado em</th>
              <th className="action-cell"></th>
            </tr>
          </thead>
          <tbody>
            {marketDataList.length === 0 ? (
              <tr>
                <td colSpan="8">Sem dados de mercado cadastrados.</td>
              </tr>
            ) : (
              marketDataList.map((entry) => (
                <tr key={entry.companyId}>
                  <td>{findCompanyLabel(entry.companyId)}</td>
                  <td>{formatNumber(entry.revenue)}</td>
                  <td>{formatNumber(entry.ebitda)}</td>
                  <td>{formatNumber(entry.netDebt)}</td>
                  <td>{Number(entry.beta).toFixed(2)}</td>
                  <td>R$ {formatMoney(entry.currentStockPrice)}</td>
                  <td>{entry.updatedAt ? new Date(entry.updatedAt).toLocaleString('pt-BR') : '-'}</td>
                  <td className="action-cell">
                    <button
                      type="button"
                      className="delete-company-btn"
                      onClick={() => handleMarketDataDelete(entry.companyId)}
                      title="Remover dados de mercado"
                      aria-label={`Remover dados de ${findCompanyLabel(entry.companyId)}`}
                    >
                      x
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </article>
    </section>
  );
}

export default DadosMercadoPage;
