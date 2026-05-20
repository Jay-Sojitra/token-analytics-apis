const express = require('express');
const { getUserFills, getUserFunding, getClearinghouseState } = require('../services/hyperliquidService');
const { calculateDailyPnl } = require('../utils/pnlCalculator');

const router = express.Router();

const WALLET_RE = /^0x[0-9a-fA-F]{40}$/;

router.get('/hyperliquid/:wallet/pnl', async (req, res, next) => {
  const { wallet } = req.params;
  const { start, end } = req.query;

  if (!WALLET_RE.test(wallet)) {
    return res.status(400).json({
      error: 'Invalid wallet address. Must be a 42-character Ethereum address (0x...).',
    });
  }

  if (!start || !end) {
    return res.status(400).json({ error: 'Query params start and end (YYYY-MM-DD) are required.' });
  }

  const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
  if (!DATE_RE.test(start) || !DATE_RE.test(end)) {
    return res.status(400).json({ error: 'start and end must be in YYYY-MM-DD format.' });
  }

  const startMs = new Date(start + 'T00:00:00Z').getTime();
  const endMs = new Date(end + 'T23:59:59Z').getTime();

  if (isNaN(startMs) || isNaN(endMs) || startMs > endMs) {
    return res.status(400).json({ error: 'Invalid date range. start must be before or equal to end.' });
  }

  try {
    const [fills, funding, state] = await Promise.all([
      getUserFills(wallet, startMs, endMs),
      getUserFunding(wallet, startMs, endMs),
      getClearinghouseState(wallet),
    ]);

    const { daily, summary } = calculateDailyPnl({ start, end, fills, funding, state });

    res.json({
      wallet,
      start,
      end,
      daily,
      summary,
      diagnostics: {
        data_source: 'hyperliquid_api',
        last_api_call: new Date().toISOString(),
        notes: 'Unrealized PnL reflects current open positions snapshot. Realized PnL from closed trades in range.',
      },
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
