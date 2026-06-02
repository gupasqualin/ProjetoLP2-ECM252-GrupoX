import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';

const API_BASE_URL = '/api';
const VALUATION_API_BASE_URL = '/api-valuation';

function classifyUpside(upsidePercent) {
  if (!Number.isFinite(upsidePercent)) {
    return '-';
  }

  if (upsidePercent >= 0.1) {
    return 'Compra';
  }

  if (upsidePercent <= -0.1) {
    return 'Venda';
  }

  return 'Neutro';
}

function ValuationPage() {
  const [companies, setCompanies] = useState([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState('');
  const [valuationData, setValuationData] = useState(null);
  const [valuationLoading, setValuationLoading] = useState(false);
  const [valuationError, setValuationError] = useState('');
  const [valuationSuccess, setValuationSuccess] = useState('');

  const loadCompanies = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/empresas`);
      setCompanies(response.data);
    } catch {
      setValuationError('Nao foi possivel carregar as empresas. Verifique se o microservico esta ativo.');
    }
  };

  const loadValuation = async (companyId) => {
    if (!companyId) {
      return;
    }

    setValuationLoading(true);
    setValuationError('');
    setValuationSuccess('');

    try {
      const response = await axios.get(`${VALUATION_API_BASE_URL}/valuation/${companyId}`);
      setValuationData(response.data);
    } catch (error) {
      const message = error?.response?.data?.message
        || 'Valuation ainda nao calculado para esta empresa.';
      setValuationData(null);
      setValuationError(message);
    } finally {
      setValuationLoading(false);
    }
  };

  useEffect(() => {
    loadCompanies();
  }, []);

  useEffect(() => {
    if (companies.length > 0 && !selectedCompanyId) {
      setSelectedCompanyId(String(companies[0].id));
    }
  }, [companies, selectedCompanyId]);

  useEffect(() => {
    if (selectedCompanyId) {
      loadValuation(selectedCompanyId);
    }
  }, [selectedCompanyId]);

  const handleCompanyChange = (event) => {
    setSelectedCompanyId(event.target.value);
  };

  const handleRecalculateValuation = async () => {
    if (!selectedCompanyId) {
      setValuationError('Selecione uma empresa para calcular o valuation.');
      return;
    }

    setValuationLoading(true);
    setValuationError('');
    setValuationSuccess('');

    try {
      const response = await axios.post(
        `${VALUATION_API_BASE_URL}/valuation/${selectedCompanyId}/recalculate`
      );
      setValuationData(response.data);
      setValuationSuccess('Valuation recalculado com sucesso!');
    } catch (error) {
      const message = error?.response?.data?.message
        || 'Erro ao recalcular valuation. Tente novamente.';
      setValuationError(message);
    } finally {
      setValuationLoading(false);
    }
  };

  const projectedCashFlows = valuationData?.projectedCashFlows ?? [];
  const summary = useMemo(() => {
    if (!valuationData) {
      return {};
    }

    return {
      exitValue: valuationData.valuation?.enterpriseValue ?? null,
      netDebt: valuationData.marketData?.netDebt ?? null,
      equityValue: valuationData.valuation?.equityValue ?? null,
      sharesOutstanding: valuationData.marketData?.sharesOutstanding ?? null,
      intrinsicPerShare: valuationData.valuation?.fairValuePerShare ?? null,
      marketPerShare: valuationData.marketData?.currentStockPrice ?? null
    };
  }, [valuationData]);

  const rateComparison = useMemo(() => {
    if (!valuationData) {
      return {};
    }

    return {
      manualDiscountRate: valuationData.rates?.manualDiscountRate ?? null,
      waccReference: valuationData.rates?.waccReference ?? null,
      spread: valuationData.rates?.discountRateMinusWaccReference ?? null
    };
  }, [valuationData]);

  const upsidePercent = valuationData?.valuation?.upsidePercent;
  const upsideRecommendation = classifyUpside(upsidePercent);

  const formatNumber = (value) => String(value ?? '-');
  const formatMoney = (value) => (
    value == null
      ? '-'
      : Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  );
  const formatRate = (value) => (
    value == null
      ? '-'
      : `${(Number(value) * 100).toFixed(2)}%`
  );

  const totalNominalFcff = projectedCashFlows.reduce(
    (accumulator, yearData) => accumulator + Number(yearData.fcff || 0),
    0
  );

  return (
    <section className="company-section">
      <article className="panel valuation-panel">
        <div className="valuation-panel-header">
          <h2>Valuation</h2>
          <div className="inline-actions">
            <button
              type="button"
              onClick={handleRecalculateValuation}
              disabled={valuationLoading}
            >
              {valuationLoading ? 'Calculando...' : 'Recalcular valuation'}
            </button>
          </div>
        </div>

        <div className="company-form">
          <select
            name="companyId"
            value={selectedCompanyId}
            onChange={handleCompanyChange}
            aria-label="Selecione a empresa para valuation"
          >
            <option value="">Selecione uma empresa</option>
            {companies.length === 0 ? (
              <option value="" disabled>Nenhuma empresa cadastrada</option>
            ) : (
              companies.map((company) => (
                <option key={company.id} value={company.id}>
                  {company.name} ({company.ticker})
                </option>
              ))
            )}
          </select>
        </div>

        {valuationError && <p className="feedback error">{valuationError}</p>}
        {valuationSuccess && <p className="feedback success">{valuationSuccess}</p>}
      </article>

      <article className="panel">
        <h2>Fluxo de Caixa Descontado</h2>
        <table>
          <thead>
            <tr>
              <th>Metrica</th>
              {projectedCashFlows.map((yearData) => (
                <th key={`header-year-${yearData.year}`}>Ano {yearData.year}</th>
              ))}
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            {projectedCashFlows.length === 0 ? (
              <tr>
                <td colSpan="2">Sem dados de fluxo de caixa carregados.</td>
              </tr>
            ) : (
              <>
                <tr>
                  <td>Receita</td>
                  {projectedCashFlows.map((yearData) => (
                    <td key={`revenue-${yearData.year}`}>{formatMoney(yearData.revenue)}</td>
                  ))}
                  <td>-</td>
                </tr>
                <tr>
                  <td>EBITDA</td>
                  {projectedCashFlows.map((yearData) => (
                    <td key={`ebitda-${yearData.year}`}>{formatMoney(yearData.ebitda)}</td>
                  ))}
                  <td>-</td>
                </tr>
                <tr>
                  <td>FCFF</td>
                  {projectedCashFlows.map((yearData) => (
                    <td key={`fcff-${yearData.year}`}>{formatMoney(yearData.fcff)}</td>
                  ))}
                  <td>{formatMoney(totalNominalFcff)}</td>
                </tr>
                <tr>
                  <td>FCFF a Valor Presente</td>
                  {projectedCashFlows.map((yearData) => (
                    <td key={`pv-fcff-${yearData.year}`}>{formatMoney(yearData.presentValueFcff)}</td>
                  ))}
                  <td>{formatMoney(valuationData?.valuation?.discountedCashFlows)}</td>
                </tr>
                <tr>
                  <td>Valor Terminal a VP</td>
                  <td colSpan={projectedCashFlows.length}>
                    Metodo: {valuationData?.terminalValue?.method || '-'}
                  </td>
                  <td>{formatMoney(valuationData?.terminalValue?.presentValueTerminalValue)}</td>
                </tr>
                <tr>
                  <td>Enterprise Value</td>
                  <td colSpan={projectedCashFlows.length}>Soma FCFF VP + Valor Terminal VP</td>
                  <td>{formatMoney(summary.exitValue)}</td>
                </tr>
              </>
            )}
          </tbody>
        </table>
      </article>

      <section className="valuation-grid">
        <article className="panel valuation-box">
          <h3>Caminho do Valuation</h3>

          <div className="valuation-row">
            <span>Enterprise Value:</span>
            <strong>{formatMoney(summary.exitValue)}</strong>
          </div>
          <div className="valuation-row">
            <span>Discount Rate (manual):</span>
            <strong>{formatRate(rateComparison.manualDiscountRate)}</strong>
          </div>
          <div className="valuation-row">
            <span>WACC de referencia (CAPM):</span>
            <strong>{formatRate(rateComparison.waccReference)}</strong>
          </div>
          <div className="valuation-row">
            <span>Spread (manual - WACC):</span>
            <strong>{formatRate(rateComparison.spread)}</strong>
          </div>
          <div className="valuation-row">
            <span>Divida Liquida:</span>
            <strong>{formatMoney(summary.netDebt)}</strong>
          </div>
          <div className="valuation-row">
            <span>Equity Value:</span>
            <strong>{formatMoney(summary.equityValue)}</strong>
          </div>
          <div className="valuation-row">
            <span>Acoes:</span>
            <strong>{formatNumber(summary.sharesOutstanding)}</strong>
          </div>
          <div className="valuation-row">
            <span>Preco Justo:</span>
            <strong>{formatMoney(summary.intrinsicPerShare)}</strong>
          </div>
        </article>

        <div className="summary-grid">
          <article className="panel mini">
            <h3>Valor Intrinseco</h3>
            <p>Valor patrimonial/acao</p>
            <div className="mini-main">
              <strong>{formatMoney(summary.intrinsicPerShare)}</strong>
            </div>
          </article>

          <article className="panel mini">
            <h3>Valor de Mercado</h3>
            <p>Valor patrimonial/acao</p>
            <div className="mini-main">
              <strong>{formatMoney(summary.marketPerShare)}</strong>
            </div>
          </article>

          <article className="panel mini">
            <h3>Taxa de Retorno - Upside(%)</h3>
            <p>Potencial de Alta do Preco-Alvo</p>
            <div className="mini-main">
              <strong>{formatRate(upsidePercent)} ({upsideRecommendation})</strong>
            </div>
          </article>
        </div>
      </section>
    </section>
  );
}

export default ValuationPage;