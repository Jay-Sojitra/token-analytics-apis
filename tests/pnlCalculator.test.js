const { calculateDailyPnl, dateRange, groupByDate } = require('../src/utils/pnlCalculator');

describe('dateRange', () => {
  it('returns single date when start equals end', () => {
    expect(dateRange('2025-01-01', '2025-01-01')).toEqual(['2025-01-01']);
  });

  it('returns correct range', () => {
    const range = dateRange('2025-01-01', '2025-01-03');
    expect(range).toEqual(['2025-01-01', '2025-01-02', '2025-01-03']);
  });
});

describe('groupByDate', () => {
  it('groups items by UTC date', () => {
    const items = [
      { time: new Date('2025-01-01T10:00:00Z').getTime(), val: 1 },
      { time: new Date('2025-01-01T22:00:00Z').getTime(), val: 2 },
      { time: new Date('2025-01-02T05:00:00Z').getTime(), val: 3 },
    ];
    const grouped = groupByDate(items);
    expect(grouped['2025-01-01']).toHaveLength(2);
    expect(grouped['2025-01-02']).toHaveLength(1);
  });
});

describe('calculateDailyPnl', () => {
  const makeTs = (dateStr) => new Date(dateStr + 'T12:00:00Z').getTime();

  const fills = [
    { time: makeTs('2025-01-01'), closedPnl: '100.5', fee: '2.0' },
    { time: makeTs('2025-01-01'), closedPnl: '50.0', fee: '1.0' },
    { time: makeTs('2025-01-02'), closedPnl: '-20.0', fee: '0.5' },
  ];

  const funding = [
    { time: makeTs('2025-01-01'), delta: { usdc: '-0.5' } },
    { time: makeTs('2025-01-02'), delta: { usdc: '1.0' } },
  ];

  const state = {
    assetPositions: [{ position: { coin: 'ETH', szi: '1', entryPx: '2000', unrealizedPnl: '50.0' } }],
    marginSummary: { accountValue: '10050.0' },
  };

  it('calculates realized PnL per day', () => {
    const { daily } = calculateDailyPnl({ start: '2025-01-01', end: '2025-01-02', fills, funding, state });
    expect(daily[0].realized_pnl_usd).toBe(150.5);
    expect(daily[1].realized_pnl_usd).toBe(-20.0);
  });

  it('calculates fees per day', () => {
    const { daily } = calculateDailyPnl({ start: '2025-01-01', end: '2025-01-02', fills, funding, state });
    expect(daily[0].fees_usd).toBe(3.0);
    expect(daily[1].fees_usd).toBe(0.5);
  });

  it('calculates funding per day', () => {
    const { daily } = calculateDailyPnl({ start: '2025-01-01', end: '2025-01-02', fills, funding, state });
    expect(daily[0].funding_usd).toBe(-0.5);
    expect(daily[1].funding_usd).toBe(1.0);
  });

  it('calculates net PnL: realized + unrealized - fees + funding', () => {
    const { daily } = calculateDailyPnl({ start: '2025-01-01', end: '2025-01-01', fills, funding, state });
    // 150.5 + 50.0 - 3.0 + (-0.5) = 197.0
    expect(daily[0].net_pnl_usd).toBe(197);
  });

  it('shows equity from clearinghouseState on each day', () => {
    const { daily } = calculateDailyPnl({ start: '2025-01-01', end: '2025-01-02', fills, funding, state });
    expect(daily[0].equity_usd).toBe(10050);
    expect(daily[1].equity_usd).toBe(10050);
  });

  it('returns zero values for days with no activity', () => {
    const { daily } = calculateDailyPnl({ start: '2025-01-05', end: '2025-01-05', fills: [], funding: [], state: {} });
    expect(daily[0].realized_pnl_usd).toBe(0);
    expect(daily[0].fees_usd).toBe(0);
    expect(daily[0].funding_usd).toBe(0);
  });

  it('aggregates summary correctly', () => {
    const { summary } = calculateDailyPnl({ start: '2025-01-01', end: '2025-01-02', fills, funding, state });
    expect(summary.total_realized_usd).toBe(130.5);
    expect(summary.total_fees_usd).toBe(3.5);
    expect(summary.total_funding_usd).toBe(0.5);
  });
});
