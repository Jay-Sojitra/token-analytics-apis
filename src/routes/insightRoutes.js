const express = require('express');
const { fetchTokenData, fetchMarketChart } = require('../services/coingeckoService');
const { getTokenInsight, MODEL } = require('../services/aiService');

const router = express.Router();

router.post('/token/:id/insight', async (req, res, next) => {
  const { id } = req.params;
  const vs_currency = req.body?.vs_currency || 'usd';
  const history_days = req.body?.history_days || 30;

  try {
    const [tokenRaw, chartRaw] = await Promise.all([
      fetchTokenData(id),
      fetchMarketChart(id, vs_currency, history_days),
    ]);

    const md = tokenRaw.market_data || {};
    const marketData = {
      current_price_usd: md.current_price?.[vs_currency] ?? null,
      market_cap_usd: md.market_cap?.[vs_currency] ?? null,
      total_volume_usd: md.total_volume?.[vs_currency] ?? null,
      price_change_percentage_24h: md.price_change_percentage_24h ?? null,
    };

    const promptPayload = {
      id: tokenRaw.id,
      symbol: tokenRaw.symbol,
      name: tokenRaw.name,
      market_data: marketData,
      ...(chartRaw?.prices && {
        price_history_30d: chartRaw.prices.slice(-7).map(([ts, price]) => ({
          date: new Date(ts).toISOString().slice(0, 10),
          price: parseFloat(price.toFixed(4)),
        })),
      }),
    };

    const insight = await getTokenInsight(promptPayload);

    res.json({
      source: 'coingecko',
      token: {
        id: tokenRaw.id,
        symbol: tokenRaw.symbol,
        name: tokenRaw.name,
        market_data: marketData,
      },
      insight,
      model: { provider: 'z.ai', model: MODEL },
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
