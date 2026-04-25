import { useEffect, useState } from 'react';
import axios from 'axios';

const API_BASE_URL = '/api';

const initialAssumptionsForm = {
  companyId: '',
  projectionYears: 5,
  discountRate: '',
  riskFreeRate: '',
  marketRiskPremium: '',
  workingCapitalChangePercentOfRevenue: '',
  terminalValueMethod: 'GORDON',
  projectedEbitdaMargin: '',
  revenueGrowthByYear: '',
  capexPercentOfRevenue: '',
  perpetualGrowthRate: '',
  exitMultiple: ''
};

function isPartialNumber(value, allowNegative = false) {
  const numberPattern = allowNegative
    ? /^-?(?:\d+|\d{1,3}(?:\.\d{3})*)(?:[.,]\d*)?$/
    : /^(?:\d+|\d{1,3}(?:\.\d{3})*)(?:[.,]\d*)?$/;
  return numberPattern.test(value);
}

function PremissasProjecaoPage() {
  const [companies, setCompanies] = useState([]);
  const [assumptionsList, setAssumptionsList] = useState([]);
  const [assumptionsForm, setAssumptionsForm] = useState(initialAssumptionsForm);
  const [assumptionsLoading, setAssumptionsLoading] = useState(false);
  const [assumptionsError, setAssumptionsError] = useState('');
  const [assumptionsSuccess, setAssumptionsSuccess] = useState('');
  const [valuationLoading, setValuationLoading] = useState(false);
  const [valuationError, setValuationError] = useState('');
  const [valuationSuccess, setValuationSuccess] = useState('');

  const loadCompanies = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/empresas`);
      setCompanies(response.data);
    } catch {
      setAssumptionsError('Não foi possível carregar as empresas. Verifique se o microserviço está ativo.');
    }
  };

  const loadAssumptions = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/premissas`);
      setAssumptionsList(response.data);
    } catch {
      setAssumptionsError('Não foi possível carregar as premissas.');
    }
  };

  useEffect(() => {
    loadCompanies();
    loadAssumptions();
  }, []);

  // Limpa mensagens após 5 segundos
  useEffect(() => {
    if (assumptionsSuccess) {
      const timer = setTimeout(() => setAssumptionsSuccess(''), 5000);
      return () => clearTimeout(timer);
    }
  }, [assumptionsSuccess]);

  useEffect(() => {
    if (valuationSuccess) {
      const timer = setTimeout(() => setValuationSuccess(''), 5000);
      return () => clearTimeout(timer);
    }
  }, [valuationSuccess]);

  const handleAssumptionChange = (event) => {
    const { name, value } = event.target;
    setAssumptionsForm((prev) => ({ ...prev, [name]: value }));
  };

  const resetForm = () => {
    setAssumptionsForm(initialAssumptionsForm);
  };

  const normalizeNumber = (value) => {
    if (!value) return '';
    return value.toString().replace(/\./g, '').replace(',', '.').trim();
  };

  const parseNumber = (value) => {
    const normalized = normalizeNumber(value);
    return normalized === '' ? NaN : parseFloat(normalized);
  };

  const handleAssumptionsSubmit = async (event) => {
    event.preventDefault();
    setAssumptionsLoading(true);
    setAssumptionsError('');
    setAssumptionsSuccess('');

    try {
      const companyId = parseInt(assumptionsForm.companyId, 10);

      if (!companyId) {
        setAssumptionsError('Selecione uma empresa.');
        setAssumptionsLoading(false);
        return;
      }

      const discountRate = parseNumber(assumptionsForm.discountRate);
      const riskFreeRate = assumptionsForm.riskFreeRate
        ? parseNumber(assumptionsForm.riskFreeRate)
        : null;
      const marketRiskPremium = assumptionsForm.marketRiskPremium
        ? parseNumber(assumptionsForm.marketRiskPremium)
        : null;

      const revenueGrowthArray = assumptionsForm.revenueGrowthByYear
        .split(/[;,]+/)
        .map((x) => parseNumber(x))
        .filter((x) => !isNaN(x));

      if (revenueGrowthArray.length !== parseInt(assumptionsForm.projectionYears, 10)) {
        setAssumptionsError(`Informe ${assumptionsForm.projectionYears} taxas de crescimento separadas por vírgula ou ponto e vírgula.`);
        setAssumptionsLoading(false);
        return;
      }

      const payload = {
        companyId,
        projectionYears: parseInt(assumptionsForm.projectionYears, 10),
        discountRate: isNaN(discountRate) ? 0 : discountRate,
        riskFreeRate: isNaN(riskFreeRate) ? null : riskFreeRate,
        marketRiskPremium: isNaN(marketRiskPremium) ? null : marketRiskPremium,
        workingCapitalChangePercentOfRevenue: parseNumber(
          assumptionsForm.workingCapitalChangePercentOfRevenue
        ),
        terminalValueMethod: assumptionsForm.terminalValueMethod,
        projectedEbitdaMargin: parseNumber(
          assumptionsForm.projectedEbitdaMargin
        ),
        revenueGrowthByYear: revenueGrowthArray,
        capexPercentOfRevenue: parseNumber(
          assumptionsForm.capexPercentOfRevenue
        ),
        perpetualGrowthRate: parseNumber(
          assumptionsForm.perpetualGrowthRate
        )
      };

      if (assumptionsForm.terminalValueMethod === 'EXIT_MULTIPLE') {
        const exitMultiple = parseNumber(assumptionsForm.exitMultiple);
        payload.exitMultiple = isNaN(exitMultiple) ? null : exitMultiple;
      } else {
        payload.exitMultiple = null;
      }

      const response = await axios.post(`${API_BASE_URL}/premissas`, payload);
      setAssumptionsList((prev) => {
        const filtered = prev.filter((x) => x.companyId !== payload.companyId);
        return [...filtered, response.data];
      });
      resetForm();
      setAssumptionsSuccess('Premissas salvas com sucesso!');
    } catch (error) {
      setAssumptionsError(
        error.response?.data?.message || 'Erro ao salvar premissas. Tente novamente.'
      );
    } finally {
      setAssumptionsLoading(false);
    }
  };

  const handleRecalculateValuation = async () => {
    setValuationLoading(true);
    setValuationError('');
    setValuationSuccess('');

    try {
      const companyId = parseInt(assumptionsForm.companyId || 0);

      if (!companyId) {
        setValuationError('Selecione uma empresa para calcular o valuation.');
        setValuationLoading(false);
        return;
      }

      const payload = { companyId };
      await axios.post(`${API_BASE_URL}/valuations/recalculate`, payload);
      setValuationSuccess('Valuation recalculado com sucesso!');
    } catch (error) {
      setValuationError(
        error.response?.data?.message || 'Erro ao recalcular valuation. Tente novamente.'
      );
    } finally {
      setValuationLoading(false);
    }
  };

  const handleAssumptionsDelete = async (companyId) => {
    if (confirm('Tem certeza que deseja remover essas premissas?')) {
      try {
        await axios.delete(`${API_BASE_URL}/premissas/${companyId}`);
        setAssumptionsList((prev) => prev.filter((x) => x.companyId !== companyId));
        setAssumptionsSuccess('Premissas removidas com sucesso!');
      } catch (error) {
        setAssumptionsError(
          error.response?.data?.message || 'Erro ao remover premissas. Tente novamente.'
        );
      }
    }
  };

  const findCompanyLabel = (companyId) => {
    const company = companies.find((c) => c.id === companyId);
    return company ? `${company.name} (${company.ticker})` : 'Desconhecida';
  };

  const formatRate = (rate) => {
    if (rate === null || rate === undefined) return '-';
    return `${(rate * 100).toFixed(2)}%`;
  };

  const formatNumber = (num) => {
    if (num === null || num === undefined) return '-';
    return parseFloat(num).toFixed(2);
  };

  return (
    <section className="company-section">
      <article className="panel assumptions">
        <h2>Premissas de Projeção</h2>

        <form className="assumption-list" onSubmit={handleAssumptionsSubmit}>
          <label className="full-width">
            <span>Empresa</span>
            <select 
              name="companyId"
              value={assumptionsForm.companyId}
              onChange={handleAssumptionChange}
              required
            >
              <option value="">Selecione uma empresa</option>
              {companies.length === 0 ? (
                <option value="" disabled>Cadastre uma empresa primeiro</option>
              ) : (
                companies.map((company) => (
                  <option key={company.id} value={company.id}>
                    {company.name} ({company.ticker})
                  </option>
                ))
              )}
            </select>
          </label>

          <label>
            <span>Anos de Projeção</span>
            <input
              name="projectionYears"
              type="number"
              min="1"
              max="20"
              value={assumptionsForm.projectionYears}
              onChange={handleAssumptionChange}
              required
            />
          </label>

          <label>
            <span>Taxa de Desconto (0 a 1)</span>
            <input
              name="discountRate"
              type="text"
              value={assumptionsForm.discountRate}
              onChange={handleAssumptionChange}
              onBlur={(e) => {
                if (e.target.value && !isPartialNumber(e.target.value, true)) {
                  e.target.value = '';
                }
              }}
              placeholder="0,10"
              required
            />
          </label>

          <label>
            <span>Taxa Livre de Risco (opcional)</span>
            <input
              name="riskFreeRate"
              type="text"
              placeholder="Padrão: 0,045 (4,5%)"
              value={assumptionsForm.riskFreeRate}
              onChange={handleAssumptionChange}
              onBlur={(e) => {
                if (e.target.value && !isPartialNumber(e.target.value, true)) {
                  e.target.value = '';
                }
              }}
            />
          </label>

          <label>
            <span>Prêmio de Risco de Mercado (opcional)</span>
            <input
              name="marketRiskPremium"
              type="text"
              placeholder="Padrão: 0,055 (5,5%)"
              value={assumptionsForm.marketRiskPremium}
              onChange={handleAssumptionChange}
              onBlur={(e) => {
                if (e.target.value && !isPartialNumber(e.target.value, true)) {
                  e.target.value = '';
                }
              }}
            />
          </label>

          <label>
            <span>Var. Capital de Giro (% Receita)</span>
            <input
              name="workingCapitalChangePercentOfRevenue"
              type="text"
              value={assumptionsForm.workingCapitalChangePercentOfRevenue}
              onChange={handleAssumptionChange}
              onBlur={(e) => {
                if (e.target.value && !isPartialNumber(e.target.value, true)) {
                  e.target.value = '';
                }
              }}
              placeholder="0,05"
              required
            />
          </label>

          <label>
            <span>Método Valor Terminal</span>
            <select
              name="terminalValueMethod"
              value={assumptionsForm.terminalValueMethod}
              onChange={handleAssumptionChange}
              required
            >
              <option value="GORDON">GORDON</option>
              <option value="EXIT_MULTIPLE">EXIT_MULTIPLE</option>
            </select>
          </label>

          <label>
            <span>Margem EBITDA Projetada</span>
            <input
              name="projectedEbitdaMargin"
              type="text"
              value={assumptionsForm.projectedEbitdaMargin}
              onChange={handleAssumptionChange}
              onBlur={(e) => {
                if (e.target.value && !isPartialNumber(e.target.value, true)) {
                  e.target.value = '';
                }
              }}
              placeholder="0,25"
              required
            />
          </label>

          <label>
            <span>Cresc. Receita por Ano</span>
            <input
              name="revenueGrowthByYear"
              placeholder="Ex: 0,1;0,08;0,07"
              value={assumptionsForm.revenueGrowthByYear}
              onChange={handleAssumptionChange}
              required
            />
          </label>

          <label>
            <span>Capex (% da Receita)</span>
            <input
              name="capexPercentOfRevenue"
              type="text"
              value={assumptionsForm.capexPercentOfRevenue}
              onChange={handleAssumptionChange}
              onBlur={(e) => {
                if (e.target.value && !isPartialNumber(e.target.value, true)) {
                  e.target.value = '';
                }
              }}
              placeholder="0,08"
              required
            />
          </label>

          <label>
            <span>Crescimento Perpetuidade (g)</span>
            <input
              name="perpetualGrowthRate"
              type="text"
              value={assumptionsForm.perpetualGrowthRate}
              onChange={handleAssumptionChange}
              onBlur={(e) => {
                if (e.target.value && !isPartialNumber(e.target.value, true)) {
                  e.target.value = '';
                }
              }}
              placeholder="0,03"
              required
            />
          </label>

          <label>
            <span>Múltiplo de Saída</span>
            <input
              name="exitMultiple"
              type="text"
              value={assumptionsForm.exitMultiple}
              onChange={handleAssumptionChange}
              onBlur={(e) => {
                if (e.target.value && !isPartialNumber(e.target.value, true)) {
                  e.target.value = '';
                }
              }}
              placeholder="6,0"
              disabled={assumptionsForm.terminalValueMethod !== 'EXIT_MULTIPLE'}
              required={assumptionsForm.terminalValueMethod === 'EXIT_MULTIPLE'}
            />
          </label>

          <div className="inline-actions assumption-actions full-width">
            <button type="submit" disabled={assumptionsLoading || companies.length === 0}>
              {assumptionsLoading ? 'Salvando...' : 'Salvar premissas'}
            </button>
            <button
              type="button"
              className="secondary-btn"
              onClick={handleRecalculateValuation}
              disabled={valuationLoading || !assumptionsForm.companyId}
            >
              {valuationLoading ? 'Calculando...' : 'Calcular valuation'}
            </button>
            <button
              type="button"
              className="secondary-btn"
              onClick={resetForm}
              disabled={assumptionsLoading}
            >
              Limpar
            </button>
          </div>

          {assumptionsError && <p className="feedback error">{assumptionsError}</p>}
          {assumptionsSuccess && <p className="feedback success">{assumptionsSuccess}</p>}
          {valuationError && <p className="feedback error">{valuationError}</p>}
          {valuationSuccess && <p className="feedback success">{valuationSuccess}</p>}
        </form>
      </article>

      <article className="panel company-panel">
        <h2>Premissas Salvas</h2>

        <table>
          <thead>
            <tr>
              <th>Empresa</th>
              <th>Anos</th>
              <th>Taxa Desc.</th>
              <th>Rf</th>
              <th>MRP</th>
              <th>g</th>
              <th>Método TV</th>
              <th>Múltiplo</th>
              <th className="action-cell"></th>
            </tr>
          </thead>
          <tbody>
            {assumptionsList.length === 0 ? (
              <tr>
                <td colSpan="9">Sem premissas cadastradas.</td>
              </tr>
            ) : (
              assumptionsList.map((entry) => (
                <tr key={entry.companyId}>
                  <td>{findCompanyLabel(entry.companyId)}</td>
                  <td>{entry.projectionYears}</td>
                  <td>{formatRate(entry.discountRate)}</td>
                  <td>{formatRate(entry.riskFreeRate)}</td>
                  <td>{formatRate(entry.marketRiskPremium)}</td>
                  <td>{formatRate(entry.perpetualGrowthRate)}</td>
                  <td>{entry.terminalValueMethod}</td>
                  <td>{entry.exitMultiple === null ? '-' : formatNumber(entry.exitMultiple)}</td>
                  <td className="action-cell">
                    <button
                      type="button"
                      className="delete-company-btn"
                      onClick={() => handleAssumptionsDelete(entry.companyId)}
                      title="Remover premissas"
                      aria-label={`Remover premissas de ${findCompanyLabel(entry.companyId)}`}
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
  );
}

export default PremissasProjecaoPage;
