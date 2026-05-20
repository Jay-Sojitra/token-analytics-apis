# Token Insight & Analytics API

DappLooker Backend Assignment — Node.js/Express backend with two endpoints:
1. **Token Insight** — CoinGecko market data + GLM-5.1 AI analysis
2. **HyperLiquid PnL** — Daily realized/unrealized PnL for a wallet address

---

## Prerequisites

- Node.js 18+ (or Docker)
- A Z.AI API key ([get one at z.ai](https://z.ai))

---

## Setup

```bash
git clone <repo-url>
cd token-analytics-api
cp .env.example .env
# Open .env and set Z_AI_API_KEY=your_key_here
```

---

## Running Locally

```bash
npm install
npm start
# Server starts at http://localhost:3000
```

## Running with Docker

```bash
docker compose up --build
# Server starts at http://localhost:3000
# Stop with: docker compose down
```

---

## Running Tests

Tests use mocked HTTP clients — they don't need the server or Docker running.

```bash
npm test
# 24 tests across 3 files (insight, hyperliquid, pnlCalculator)
```

---

## API Reference

### Health Check

```
GET /health
```

---

### 1. Token Insight

```
POST /api/token/:id/insight
```

**Parameters:**
- `:id` — CoinGecko token ID (e.g. `bitcoin`, `ethereum`, `chainlink`)

**Optional body:**
```json
{
  "vs_currency": "usd",
  "history_days": 30
}
```

**Example:**
```bash
curl -X POST http://localhost:3000/api/token/bitcoin/insight \
  -H "Content-Type: application/json" \
  -d '{"vs_currency": "usd", "history_days": 30}'
```

**Response:**
```json
{
  "source": "coingecko",
  "token": {
    "id": "bitcoin",
    "symbol": "btc",
    "name": "Bitcoin",
    "market_data": {
      "current_price_usd": 65000,
      "market_cap_usd": 1200000000000,
      "total_volume_usd": 30000000000,
      "price_change_percentage_24h": 2.5
    }
  },
  "insight": {
    "reasoning": "Bitcoin is showing strong upward momentum...",
    "sentiment": "Bullish"
  },
  "model": { "provider": "z.ai", "model": "glm-5.1" }
}
```

**Error codes:**
- `404` — Token ID not found on CoinGecko
- `502` — CoinGecko API unreachable

---

### 2. HyperLiquid Wallet Daily PnL

```
GET /api/hyperliquid/:wallet/pnl?start=YYYY-MM-DD&end=YYYY-MM-DD
```

**Parameters:**
- `:wallet` — Ethereum wallet address (42-char, starts with `0x`)
- `start` — Start date (inclusive)
- `end` — End date (inclusive)

**Example:**
```bash
curl "http://localhost:3000/api/hyperliquid/0xabcdef1234567890abcdef1234567890abcdef12/pnl?start=2025-01-01&end=2025-01-07"
```

**Response:**
```json
{
  "wallet": "0xabcdef...",
  "start": "2025-01-01",
  "end": "2025-01-07",
  "daily": [
    {
      "date": "2025-01-01",
      "realized_pnl_usd": 120.5,
      "unrealized_pnl_usd": 10.0,
      "fees_usd": 2.1,
      "funding_usd": -0.5,
      "net_pnl_usd": 127.9,
      "equity_usd": 10127.9
    }
  ],
  "summary": {
    "total_realized_usd": 120.5,
    "total_unrealized_usd": 10.0,
    "total_fees_usd": 2.1,
    "total_funding_usd": -0.5,
    "net_pnl_usd": 127.9
  },
  "diagnostics": {
    "data_source": "hyperliquid_api",
    "last_api_call": "2025-01-07T12:00:00.000Z",
    "notes": "Unrealized PnL reflects current open positions snapshot."
  }
}
```

**Error codes:**
- `400` — Invalid wallet address or date format
- `502` — HyperLiquid API unreachable

**Notes:**
- All dates are interpreted in **UTC**.
- HyperLiquid endpoints used: `userFillsByTime` (fills), `userFunding` (funding payments), `clearinghouseState` (positions + equity).
- **PnL formula:** `net_pnl = realized + unrealized − fees + funding`
- **Unrealized PnL** is a current snapshot from `clearinghouseState` (HyperLiquid doesn't expose historical mark-to-market, so the same value appears on each day in the range).

---

## AI Setup

This project uses **GLM-5.1** via the [Z.AI API](https://docs.z.ai/guides/overview/quick-start):

1. Create an account at [z.ai](https://z.ai) and generate an API key
2. Add it to your `.env`:
   ```
   Z_AI_API_KEY=your_key_here
   Z_AI_BASE_URL=https://api.z.ai/api/coding/paas/v4
   Z_AI_MODEL=glm-5.1
   ```
3. Restart the server (or rebuild Docker) to pick up the key

**Graceful fallback:** If `Z_AI_API_KEY` is unset, the API key is invalid, the AI returns invalid JSON, or the call fails — the `/insight` endpoint still returns 200 with a `Neutral` sentiment fallback. The endpoint never crashes due to AI issues.

---

## Project Structure

```
src/
  app.js                  — Express app + middleware
  server.js               — Entry point
  routes/
    insightRoutes.js      — POST /api/token/:id/insight
    hyperliquidRoutes.js  — GET /api/hyperliquid/:wallet/pnl
  services/
    coingeckoService.js   — CoinGecko API client
    aiService.js          — Z.AI / GLM-5.1 client
    hyperliquidService.js — HyperLiquid API client
  utils/
    pnlCalculator.js      — Daily PnL aggregation
  middleware/
    errorHandler.js       — Centralised error responses
tests/
  insight.test.js
  hyperliquid.test.js
  pnlCalculator.test.js
```
