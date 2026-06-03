function SensitivityScreen({
  sensitivityLoading,
  sensitivityError,
  sensitivityResult,
  formatRate,
  formatMoney
}) {
  return (
    <section className="sensitivity-section">
      {sensitivityLoading && <p>Calculando sensibilidade...</p>}
      {sensitivityError && <p className="feedback error">{sensitivityError}</p>}
      {!sensitivityLoading && !sensitivityResult && !sensitivityError && (
        <p>Calcule o valuation primeiro para ver a análise de sensibilidade.</p>
      )}

      {sensitivityResult && (
        <>
          <article className="panel sensitivity-panel">
            <h2>Sensibilidade - WACC x Crescimento Perpétuo (g)</h2>
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
