import { useEffect, useState } from 'react';
import axios from 'axios';

const API_BASE_URL = '/api';
const SENSITIVITY_API_BASE_URL = '/api-sensitivity';

function SensitivityScreen() {
  const [companies, setCompanies] = useState([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState('');
  const [sensitivityLoading, setSensitivityLoading] = useState(false);
  const [sensitivityError, setSensitivityError] = useState('');
  const [sensitivityResult, setSensitivityResult] = useState(null);

  const loadCompanies = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/empresas`);
      setCompanies(response.data);
    } catch {
      setSensitivityError('Nao foi possivel carregar as empresas. Verifique se o microservico esta ativo.');
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

  const handleCompanyChange = (event) => {
    setSelectedCompanyId(event.target.value);
  };

  const handleCalculateSensitivity = async () => {
    if (!selectedCompanyId) {
      setSensitivityError('Selecione uma empresa para calcular a sensibilidade.');
      return;
    }

    setSensitivityLoading(true);
    setSensitivityError('');

    try {
      const response = await axios.post(
        `${SENSITIVITY_API_BASE_URL}/sensitivity/${selectedCompanyId}/matrices`,
        { syncFromServices: true }
      );
      setSensitivityResult(response.data);
    } catch (error) {
      const message = error?.response?.data?.message
        || 'Nao foi possivel calcular a sensibilidade. Tente novamente.';
      setSensitivityResult(null);
      setSensitivityError(message);
    } finally {
      setSensitivityLoading(false);
    }
  };

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

  return (
    <section className="sensitivity-section">
      <article className="panel sensitivity-panel">
        <h2>Análise de Sensibilidade</h2>
        <div className="company-form">
          <select
            name="companyId"
            value={selectedCompanyId}
            onChange={handleCompanyChange}
            aria-label="Selecione a empresa para sensibilidade"
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
          <button
            type="button"
            onClick={handleCalculateSensitivity}
            disabled={sensitivityLoading}
          >
            {sensitivityLoading ? 'Calculando...' : 'Calcular sensibilidade'}
          </button>
        </div>

        {sensitivityError && <p className="feedback error">{sensitivityError}</p>}
      </article>

      {sensitivityLoading && <p>Calculando sensibilidade...</p>}
      {!sensitivityLoading && !sensitivityResult && !sensitivityError && (
        <p>Calcule o valuation primeiro para ver a análise de sensibilidade.</p>
      )}

      {sensitivityResult && (
        <>
          <article className="panel sensitivity-panel">
            <h2>Sensibilidade - WACC x Crescimento Perpetuo (g)</h2>
            <table>
              <thead>
                <tr>
                  <th></th>
                  {(sensitivityResult?.matrices?.waccVsG?.rows?.[0]?.cells || []).map((cell) => (
                    <th key={`wacc-g-header-${cell.gStep}`}>{formatRate(cell.perpetualGrowthRate)}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(sensitivityResult?.matrices?.waccVsG?.rows || []).length === 0 ? (
                  <tr>
                    <td colSpan="2">Sem dados para matriz WACC x g.</td>
                  </tr>
                ) : (
                  (sensitivityResult?.matrices?.waccVsG?.rows || []).map((row) => (
                    <tr key={`wacc-g-row-${row.waccStep}`}>
                      <th>{formatRate(row.discountRate)}</th>
                      {row.cells.map((cell) => (
                        <td
                          key={`wacc-g-cell-${row.waccStep}-${cell.gStep}`}
                          className={row.waccStep === 0 && cell.gStep === 0 ? 'base-cell' : ''}
                        >
                          {cell.fairValuePerShare === null ? '-' : formatMoney(cell.fairValuePerShare)}
                        </td>
                      ))}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </article>

          <article className="panel sensitivity-panel">
            <h2>Sensibilidade - WACC x Margem EBITDA</h2>
            <table>
              <thead>
                <tr>
                  <th></th>
                  {(sensitivityResult?.matrices?.waccVsEbitdaMargin?.rows?.[0]?.cells || []).map((cell) => (
                    <th key={`wacc-margin-header-${cell.ebitdaMarginStep}`}>
                      {formatRate(cell.projectedEbitdaMargin)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(sensitivityResult?.matrices?.waccVsEbitdaMargin?.rows || []).length === 0 ? (
                  <tr>
                    <td colSpan="2">Sem dados para matriz WACC x margem EBITDA.</td>
                  </tr>
                ) : (
                  (sensitivityResult?.matrices?.waccVsEbitdaMargin?.rows || []).map((row) => (
                    <tr key={`wacc-margin-row-${row.waccStep}`}>
                      <th>{formatRate(row.discountRate)}</th>
                      {row.cells.map((cell) => (
                        <td
                          key={`wacc-margin-cell-${row.waccStep}-${cell.ebitdaMarginStep}`}
                          className={row.waccStep === 0 && cell.ebitdaMarginStep === 0 ? 'base-cell' : ''}
                        >
                          {cell.fairValuePerShare === null ? '-' : formatMoney(cell.fairValuePerShare)}
                        </td>
                      ))}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </article>

          <article className="panel sensitivity-panel">
            <h2>Sensibilidade - g x Margem EBITDA</h2>
            <table>
              <thead>
                <tr>
                  <th></th>
                  {(sensitivityResult?.matrices?.gVsEbitdaMargin?.rows?.[0]?.cells || []).map((cell) => (
                    <th key={`g-margin-header-${cell.ebitdaMarginStep}`}>
                      {formatRate(cell.projectedEbitdaMargin)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(sensitivityResult?.matrices?.gVsEbitdaMargin?.rows || []).length === 0 ? (
                  <tr>
                    <td colSpan="2">Sem dados para matriz g x margem EBITDA.</td>
                  </tr>
                ) : (
                  (sensitivityResult?.matrices?.gVsEbitdaMargin?.rows || []).map((row) => (
                    <tr key={`g-margin-row-${row.gStep}`}>
                      <th>{formatRate(row.perpetualGrowthRate)}</th>
                      {row.cells.map((cell) => (
                        <td
                          key={`g-margin-cell-${row.gStep}-${cell.ebitdaMarginStep}`}
                          className={row.gStep === 0 && cell.ebitdaMarginStep === 0 ? 'base-cell' : ''}
                        >
                          {cell.fairValuePerShare === null ? '-' : formatMoney(cell.fairValuePerShare)}
                        </td>
                      ))}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </article>
        </>
      )}
    </section>
  );
}

export default SensitivityScreen;
