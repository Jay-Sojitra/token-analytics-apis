/**
 * Groups an array of items by UTC date string (YYYY-MM-DD).
 * Each item must have a `time` field in milliseconds.
 */
function groupByDate(items) {
  const map = {};
  for (const item of items) {
    const date = new Date(item.time).toISOString().slice(0, 10);
    if (!map[date]) map[date] = [];
    map[date].push(item);
  }
  return map;
}

/**
 * Generates all YYYY-MM-DD strings between start and end (inclusive).
 */
function dateRange(start, end) {
  const dates = [];
  const cur = new Date(start + 'T00:00:00Z');
  const last = new Date(end + 'T00:00:00Z');
  while (cur <= last) {
    dates.push(cur.toISOString().slice(0, 10));
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return dates;
}

/**
 * Calculates daily PnL breakdown from raw HyperLiquid data.
 *
 * @param {object} params
 * @param {string} params.start - YYYY-MM-DD
 * @param {string} params.end   - YYYY-MM-DD
 * @param {Array}  params.fills    - userFills response
 * @param {Array}  params.funding  - userFunding response
 * @param {object} params.state    - clearinghouseState response
 * @returns {{ daily: Array, summary: object }}
 */
function calculateDailyPnl({ start, end, fills = [], funding = [], state = {} }) {
  const fillsByDate = groupByDate(fills);
  const fundingByDate = groupByDate(funding);
  const dates = dateRange(start, end);

  const accountValue = parseFloat(state?.marginSummary?.accountValue || 0);
  const currentUnrealized = (state?.assetPositions || []).reduce((sum, ap) => {
    return sum + parseFloat(ap?.position?.unrealizedPnl || 0);
  }, 0);

  const daily = [];

  for (const date of dates) {
    const dayFills = fillsByDate[date] || [];
    const dayFunding = fundingByDate[date] || [];

    const realized = dayFills.reduce((sum, f) => sum + parseFloat(f.closedPnl || 0), 0);
    const fees = dayFills.reduce((sum, f) => sum + Math.abs(parseFloat(f.fee || 0)), 0);
    const fundingSum = dayFunding.reduce((sum, f) => {
      const delta = f.delta?.usdc ?? f.delta?.funding ?? 0;
      return sum + parseFloat(delta);
    }, 0);

    // Unrealized PnL snapshot — current positions, shown only as-of-now
    const unrealized = parseFloat(currentUnrealized.toFixed(4));

    const net = parseFloat((realized + unrealized - fees + fundingSum).toFixed(4));

    daily.push({
      date,
      realized_pnl_usd: parseFloat(realized.toFixed(4)),
      unrealized_pnl_usd: unrealized,
      fees_usd: parseFloat(fees.toFixed(4)),
      funding_usd: parseFloat(fundingSum.toFixed(4)),
      net_pnl_usd: net,
      equity_usd: parseFloat(accountValue.toFixed(4)),
    });
  }

  const totalRealized = daily.reduce((s, d) => s + d.realized_pnl_usd, 0);
  const totalFees = daily.reduce((s, d) => s + d.fees_usd, 0);
  const totalFunding = daily.reduce((s, d) => s + d.funding_usd, 0);

  const summary = {
    total_realized_usd: parseFloat(totalRealized.toFixed(4)),
    total_unrealized_usd: parseFloat(currentUnrealized.toFixed(4)),
    total_fees_usd: parseFloat(totalFees.toFixed(4)),
    total_funding_usd: parseFloat(totalFunding.toFixed(4)),
    net_pnl_usd: parseFloat((totalRealized + currentUnrealized - totalFees + totalFunding).toFixed(4)),
  };

  return { daily, summary };
}

module.exports = { calculateDailyPnl, dateRange, groupByDate };
