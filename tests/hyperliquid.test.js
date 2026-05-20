const request = require('supertest');
const axios = require('axios');
const app = require('../src/app');

jest.mock('axios');

const makeTs = (dateStr) => new Date(dateStr + 'T12:00:00Z').getTime();

const mockFills = [
  { time: makeTs('2025-01-01'), closedPnl: '100.0', fee: '1.5', coin: 'BTC', px: '45000', sz: '0.01', side: 'B' },
];

const mockFunding = [
  { time: makeTs('2025-01-01'), delta: { usdc: '-0.5', type: 'funding' } },
];

const mockState = {
  assetPositions: [
    { position: { coin: 'BTC', szi: '0.01', entryPx: '45000', unrealizedPnl: '10.0' } },
  ],
  marginSummary: { accountValue: '5010.0' },
};

beforeEach(() => {
  jest.clearAllMocks();
  // HyperLiquid uses axios.post — three calls: fills, funding, state
  axios.post
    .mockResolvedValueOnce({ data: mockFills })
    .mockResolvedValueOnce({ data: mockFunding })
    .mockResolvedValueOnce({ data: mockState });
});

describe('GET /api/hyperliquid/:wallet/pnl', () => {
  const validWallet = '0xabcdef1234567890abcdef1234567890abcdef12';

  it('returns correct response shape', async () => {
    const res = await request(app).get(
      `/api/hyperliquid/${validWallet}/pnl?start=2025-01-01&end=2025-01-02`
    );
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('wallet', validWallet);
    expect(res.body).toHaveProperty('start', '2025-01-01');
    expect(res.body).toHaveProperty('end', '2025-01-02');
    expect(Array.isArray(res.body.daily)).toBe(true);
    expect(res.body.daily).toHaveLength(2);
    expect(res.body.summary).toHaveProperty('net_pnl_usd');
    expect(res.body.diagnostics).toHaveProperty('data_source', 'hyperliquid_api');
  });

  it('returns correct daily PnL values', async () => {
    const res = await request(app).get(
      `/api/hyperliquid/${validWallet}/pnl?start=2025-01-01&end=2025-01-01`
    );
    expect(res.status).toBe(200);
    const day = res.body.daily[0];
    expect(day.date).toBe('2025-01-01');
    expect(day.realized_pnl_usd).toBe(100.0);
    expect(day.fees_usd).toBe(1.5);
    expect(day.funding_usd).toBe(-0.5);
  });

  it('returns 400 for invalid wallet address', async () => {
    const res = await request(app).get(
      '/api/hyperliquid/invalidwallet/pnl?start=2025-01-01&end=2025-01-02'
    );
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  it('returns 400 when start or end is missing', async () => {
    const res = await request(app).get(`/api/hyperliquid/${validWallet}/pnl?start=2025-01-01`);
    expect(res.status).toBe(400);
  });

  it('returns 400 for invalid date format', async () => {
    const res = await request(app).get(
      `/api/hyperliquid/${validWallet}/pnl?start=01-01-2025&end=01-07-2025`
    );
    expect(res.status).toBe(400);
  });

  it('returns 400 when start is after end', async () => {
    const res = await request(app).get(
      `/api/hyperliquid/${validWallet}/pnl?start=2025-01-10&end=2025-01-01`
    );
    expect(res.status).toBe(400);
  });

  it('handles empty fills gracefully', async () => {
    axios.post.mockReset();
    axios.post
      .mockResolvedValueOnce({ data: [] })
      .mockResolvedValueOnce({ data: [] })
      .mockResolvedValueOnce({ data: { assetPositions: [], marginSummary: { accountValue: '0' } } });
    const res = await request(app).get(
      `/api/hyperliquid/${validWallet}/pnl?start=2025-01-01&end=2025-01-02`
    );
    expect(res.status).toBe(200);
    expect(res.body.daily).toHaveLength(2);
    expect(res.body.daily[0].realized_pnl_usd).toBe(0);
  });

  it('returns 502 when HyperLiquid API fails', async () => {
    axios.post.mockReset();
    const err = new Error('Network error');
    err.response = { data: 'Service unavailable' };
    axios.post.mockRejectedValueOnce(err);
    const res = await request(app).get(
      `/api/hyperliquid/${validWallet}/pnl?start=2025-01-01&end=2025-01-02`
    );
    expect(res.status).toBe(502);
  });
});
