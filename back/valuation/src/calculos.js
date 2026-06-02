import { DEFAULT_MARKET_RISK_PREMIUM, DEFAULT_RISK_FREE_RATE, nowIso } from './config.js';
import { state } from './state.js';

function resolveRates(assumptions, marketData) {
  const manualDiscountRate = assumptions.discountRate;
  const riskFreeRate = Number.isFinite(Number(assumptions.riskFreeRate))
    ? Number(assumptions.riskFreeRate)
    : DEFAULT_RISK_FREE_RATE;
  const marketRiskPremium = Number.isFinite(Number(assumptions.marketRiskPremium))
    ? Number(assumptions.marketRiskPremium)
    : DEFAULT_MARKET_RISK_PREMIUM;

  const costOfEquity = riskFreeRate + (marketData.beta * marketRiskPremium);
  const costOfDebtAfterTax = marketData.costOfDebt * (1 - marketData.effectiveTaxRate);

  return {
    manualDiscountRate,
    riskFreeRate,
    marketRiskPremium,
    costOfEquity,
    costOfDebtAfterTax
  };
}

function resolveCapitalStructure(marketData, costOfEquity, costOfDebtAfterTax) {
  const marketValueEquity = marketData.currentStockPrice * marketData.sharesOutstanding;
  const marketValueDebt = marketData.totalDebt;
  const capitalBase = marketValueEquity + marketValueDebt;

  if (capitalBase <= 0) {
    return { error: 'Nao foi possivel calcular WACC de referencia: estrutura de capital invalida.' };
  }

  const waccReference = (
    (costOfEquity * marketValueEquity) + (costOfDebtAfterTax * marketValueDebt)
  ) / capitalBase;

  return {
    value: {
      marketValueEquity,
      marketValueDebt,
      capitalBase,
      waccReference
    }
  };
}

function projectCashFlows(marketData, assumptions, manualDiscountRate) {
  const depreciationRate = marketData.revenue > 0
    ? marketData.depreciation / marketData.revenue
    : 0;

  const projectedCashFlows = [];
  let previousRevenue = marketData.revenue;

  for (let i = 0; i < assumptions.projectionYears; i += 1) {
    const year = i + 1;
    const growthRate = assumptions.revenueGrowthByYear[i];
    const revenue = previousRevenue * (1 + growthRate);
    const ebitda = revenue * assumptions.projectedEbitdaMargin;
    const depreciation = revenue * depreciationRate;
    const ebit = ebitda - depreciation;
    const nopat = ebit * (1 - marketData.effectiveTaxRate);
    const capex = revenue * assumptions.capexPercentOfRevenue;
    const workingCapitalVariation = revenue * assumptions.workingCapitalChangePercentOfRevenue;
    const fcff = nopat + depreciation - capex - workingCapitalVariation;

    const discountFactor = (1 + manualDiscountRate) ** year;
    projectedCashFlows.push({
      year,
      growthRate,
      revenue,
      ebitda,
      depreciation,
      ebit,
      nopat,
      capex,
      workingCapitalVariation,
      fcff,
      discountFactor,
      presentValueFcff: fcff / discountFactor
    });

    previousRevenue = revenue;
  }

  const discountedCashFlows = projectedCashFlows.reduce(
    (accumulator, yearData) => accumulator + yearData.presentValueFcff,
    0
  );

  const lastYear = projectedCashFlows[projectedCashFlows.length - 1] || null;

  return { projectedCashFlows, discountedCashFlows, lastYear };
}

function computeTerminalValue(lastYear, assumptions, manualDiscountRate) {
  if (assumptions.terminalValueMethod === 'GORDON') {
    const nextYearFcff = lastYear.fcff * (1 + assumptions.perpetualGrowthRate);
    const denominator = manualDiscountRate - assumptions.perpetualGrowthRate;
    if (denominator <= 0) {
      return { error: 'discountRate deve ser maior que perpetualGrowthRate no metodo GORDON.' };
    }
    return {
      value: {
        terminalValue: nextYearFcff / denominator,
        terminalValueDetails: { method: 'GORDON', nextYearFcff, denominator }
      }
    };
  }

  return {
    value: {
      terminalValue: lastYear.ebitda * assumptions.exitMultiple,
      terminalValueDetails: {
        method: 'EXIT_MULTIPLE',
        finalYearEbitda: lastYear.ebitda,
        exitMultiple: assumptions.exitMultiple
      }
    }
  };
}

function calculateValuation(companyId) {
  const marketData = state.marketDataByCompany[companyId];
  const assumptions = state.assumptionsByCompany[companyId];

  if (!marketData) return { error: 'Market Data nao encontrado para esta empresa.' };
  if (!assumptions) return { error: 'Premissas de projecao nao encontradas para esta empresa.' };

  // 1) Taxas usadas para descontar os fluxos.
  const {
    manualDiscountRate,
    riskFreeRate,
    marketRiskPremium,
    costOfEquity,
    costOfDebtAfterTax
  } = resolveRates(assumptions, marketData);

  // 2) Estrutura de capital (para WACC de referencia).
  const capitalStructure = resolveCapitalStructure(marketData, costOfEquity, costOfDebtAfterTax);
  if (capitalStructure.error) {
    return { error: capitalStructure.error };
  }

  const {
    marketValueEquity,
    marketValueDebt,
    waccReference
  } = capitalStructure.value;

  // 3) Projecao anual do FCFF e soma dos valores presentes.
  const {
    projectedCashFlows,
    discountedCashFlows,
    lastYear
  } = projectCashFlows(marketData, assumptions, manualDiscountRate);

  if (!lastYear) {
    return { error: 'Nao foi possivel calcular fluxo de caixa projetado.' };
  }

  // 4) Calculo do valor terminal (Gordon ou Multiplo).
  const terminalValueResult = computeTerminalValue(lastYear, assumptions, manualDiscountRate);
  if (terminalValueResult.error) {
    return { error: terminalValueResult.error };
  }

  const { terminalValue, terminalValueDetails } = terminalValueResult.value;

  const presentValueTerminalValue = terminalValue / ((1 + manualDiscountRate) ** assumptions.projectionYears);
  const enterpriseValue = discountedCashFlows + presentValueTerminalValue;
  const equityValue = enterpriseValue - marketData.netDebt;
  const fairValuePerShare = marketData.sharesOutstanding > 0
    ? equityValue / marketData.sharesOutstanding
    : null;
  const marketCapitalization = marketData.currentStockPrice * marketData.sharesOutstanding;
  const upsidePercent = fairValuePerShare !== null && marketData.currentStockPrice > 0
    ? (fairValuePerShare / marketData.currentStockPrice) - 1
    : null;

  const response = {
    companyId,
    company: state.companiesById[companyId] || null,
    assumptions,
    marketData,
    projectedCashFlows,
    terminalValue: {
      ...terminalValueDetails,
      terminalValue,
      presentValueTerminalValue
    },
    rates: {
      manualDiscountRate,
      riskFreeRate,
      marketRiskPremium,
      costOfEquity,
      costOfDebtAfterTax,
      marketValueEquity,
      marketValueDebt,
      waccReference,
      discountRateMinusWaccReference: manualDiscountRate - waccReference
    },
    valuation: {
      discountedCashFlows,
      enterpriseValue,
      equityValue,
      marketCapitalization,
      currentStockPrice: marketData.currentStockPrice,
      fairValuePerShare,
      upsidePercent
    },
    calculatedAt: nowIso()
  };

  state.valuationsByCompany[companyId] = response;
  return { value: response };
}

export { calculateValuation };
