const axios = require('axios');

const BASE_URL = 'https://api.coingecko.com/api/v3';

async function fetchTokenData(id) {
  try {
    const { data } = await axios.get(`${BASE_URL}/coins/${id}`, {
      params: {
        localization: false,
        tickers: false,
        community_data: false,
        developer_data: false,
      },
      timeout: 10000,
    });
    return data;
  } catch (err) {
    if (err.response?.status === 404) {
      const error = new Error(`Token '${id}' not found on CoinGecko`);
      error.status = 404;
      throw error;
    }
    const error = new Error('Failed to fetch token data from CoinGecko');
    error.status = 502;
    error.details = err.message;
    throw error;
  }
}

async function fetchMarketChart(id, vs_currency = 'usd', days = 30) {
  try {
    const { data } = await axios.get(`${BASE_URL}/coins/${id}/market_chart`, {
      params: { vs_currency, days, interval: 'daily' },
      timeout: 10000,
    });
    return data;
  } catch (err) {
    // Market chart is optional — return null on failure
    return null;
  }
}

module.exports = { fetchTokenData, fetchMarketChart };
