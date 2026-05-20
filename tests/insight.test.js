const request = require('supertest');
const axios = require('axios');
const app = require('../src/app');

jest.mock('axios');

const mockCoinData = {
  id: 'bitcoin',
  symbol: 'btc',
  name: 'Bitcoin',
  market_data: {
    current_price: { usd: 65000 },
    market_cap: { usd: 1200000000000 },
    total_volume: { usd: 30000000000 },
    price_change_percentage_24h: 2.5,
  },
};

const mockChartData = {
  prices: [[1700000000000, 64000], [1700086400000, 65000]],
};

const mockAIResponse = {
  choices: [{ message: { content: '{"reasoning":"Bitcoin shows upward momentum","sentiment":"Bullish"}' } }],
};

beforeEach(() => {
  jest.clearAllMocks();
  // Default: first call = coin data, second = market chart, third = AI
  axios.get
    .mockResolvedValueOnce({ data: mockCoinData })
    .mockResolvedValueOnce({ data: mockChartData });
  axios.post.mockResolvedValueOnce({ data: mockAIResponse });
});

describe('POST /api/token/:id/insight', () => {
  it('returns correct response shape', async () => {
    process.env.Z_AI_API_KEY = 'test-key';
    const res = await request(app).post('/api/token/bitcoin/insight').send({});
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('source', 'coingecko');
    expect(res.body.token).toMatchObject({ id: 'bitcoin', symbol: 'btc', name: 'Bitcoin' });
    expect(res.body.token.market_data).toHaveProperty('current_price_usd', 65000);
    expect(res.body.insight).toHaveProperty('sentiment');
    expect(res.body.insight).toHaveProperty('reasoning');
    expect(res.body.model).toMatchObject({ provider: 'z.ai' });
  });

  it('returns valid sentiment value', async () => {
    process.env.Z_AI_API_KEY = 'test-key';
    const res = await request(app).post('/api/token/bitcoin/insight').send({});
    expect(['Bullish', 'Bearish', 'Neutral']).toContain(res.body.insight.sentiment);
  });

  it('returns 404 for unknown token', async () => {
    axios.get.mockReset();
    const err = new Error('Not Found');
    err.response = { status: 404 };
    axios.get.mockRejectedValueOnce(err);
    const res = await request(app).post('/api/token/nonexistent-token-xyz/insight').send({});
    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('error');
  });

  it('falls back gracefully when AI returns invalid JSON', async () => {
    process.env.Z_AI_API_KEY = 'test-key';
    axios.get.mockReset();
    axios.post.mockReset();
    axios.get
      .mockResolvedValueOnce({ data: mockCoinData })
      .mockResolvedValueOnce({ data: mockChartData });
    axios.post.mockResolvedValueOnce({
      data: { choices: [{ message: { content: 'This is not JSON at all' } }] },
    });
    const res = await request(app).post('/api/token/bitcoin/insight').send({});
    expect(res.status).toBe(200);
    expect(res.body.insight.sentiment).toBe('Neutral');
  });

  it('returns neutral sentiment when Z_AI_API_KEY is not set', async () => {
    delete process.env.Z_AI_API_KEY;
    const res = await request(app).post('/api/token/bitcoin/insight').send({});
    expect(res.status).toBe(200);
    expect(res.body.insight.sentiment).toBe('Neutral');
  });

  it('accepts optional body params', async () => {
    process.env.Z_AI_API_KEY = 'test-key';
    const res = await request(app)
      .post('/api/token/bitcoin/insight')
      .send({ vs_currency: 'eur', history_days: 7 });
    expect(res.status).toBe(200);
  });
});
