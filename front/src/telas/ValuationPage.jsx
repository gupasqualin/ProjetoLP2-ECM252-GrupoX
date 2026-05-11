function ValuationPage({
  projectedCashFlows,
  valuationResult,
  summary,
  rateComparison,
  upsidePercent,
  upsideRecommendation,
  valuationLoading,
  valuationError,
  valuationSuccess,
  handleRecalculateValuation,
  formatNumber,
  formatMoney,
  formatRate
}) {
  const totalNominalFcff = projectedCashFlows.reduce(
    (accumulator, yearData) => accumulator + Number(yearData.fcff || 0),
    0
  );

  return (
    <>
      <section className="valuation-actions-section">
        <div className="inline-actions">
          <button
            type="button"
            onClick={handleRecalculateValuation}
            disabled={valuationLoading}
          >
            {valuationLoading ? 'Calculando...' : 'Recalcular valuation'}
          </button>
        </div>
        {valuationError && <p className="feedback error">{valuationError}</p>}
        {valuationSuccess && <p className="feedback success">{valuationSuccess}</p>}
      </section>

      <section className="table-section">
        <h2>Fluxo de Caixa Descontado</h2>
        <table>
          <thead>
            <tr>
              <th>Métrica</th>
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
                  <td>{formatMoney(valuationResult?.valuation?.discountedCashFlows)}</td>
                </tr>
                <tr>
                  <td>Valor Terminal a VP</td>
                  <td colSpan={projectedCashFlows.length}>
                    Método: {valuationResult?.terminalValue?.method || '-'}
                  </td>
                  <td>{formatMoney(valuationResult?.terminalValue?.presentValueTerminalValue)}</td>
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
      </section>

      <section className="valuation-box-wrap">
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
            <span>WACC de referência (CAPM):</span>
            <strong>{formatRate(rateComparison.waccReference)}</strong>
          </div>
          <div className="valuation-row">
            <span>Spread (manual - WACC):</span>
            <strong>{formatRate(rateComparison.spread)}</strong>
          </div>
          <div className="valuation-row">
            <span>Dívida Líquida:</span>
            <strong>{formatMoney(summary.netDebt)}</strong>
          </div>
          <div className="valuation-row">
            <span>Equity Value:</span>
            <strong>{formatMoney(summary.equityValue)}</strong>
          </div>
          <div className="valuation-row">
            <span>Ações:</span>
            <strong>{formatNumber(summary.sharesOutstanding)}</strong>
          </div>
          <div className="valuation-row">
            <span>Preço Justo:</span>
            <strong>{formatMoney(summary.intrinsicPerShare)}</strong>
          </div>
        </article>

        <div className="summary-grid">
          <article className="panel mini">
            <h3>Valor Intrínseco</h3>
            <p>Valor patrimonial/ação</p>
            <div className="mini-main">
              <strong>{formatMoney(summary.intrinsicPerShare)}</strong>
            </div>
          </article>

          <article className="panel mini">
            <h3>Valor de Mercado</h3>
            <p>Valor patrimonial/ação</p>
            <div className="mini-main">
              <strong>{formatMoney(summary.marketPerShare)}</strong>
            </div>
          </article>

          <article className="panel mini">
            <h3>Taxa de Retorno - Upside(%)</h3>
            <p>Potencial de Alta do Preço-Alvo</p>
            <div className="mini-main">
              <strong>{formatRate(upsidePercent)} ({upsideRecommendation})</strong>
            </div>
          </article>
        </div>
      </section>
    </>
  );
}

export default ValuationPage;