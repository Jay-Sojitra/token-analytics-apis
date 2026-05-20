const axios = require('axios');

const HL_API = 'https://api.hyperliquid.xyz/info';

async function hlPost(body) {
  try {
    const { data } = await axios.post(HL_API, body, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 15000,
    });
    return data;
  } catch (err) {
    const error = new Error('HyperLiquid API request failed');
    error.status = 502;
    error.details = err.response?.data || err.message;
    throw error;
  }
}

async function getUserFills(wallet, startMs, endMs) {
  const data = await hlPost({
    type: 'userFillsByTime',
    user: wallet,
    startTime: startMs,
    endTime: endMs,
  });
  return Array.isArray(data) ? data : [];
}

async function getUserFunding(wallet, startMs, endMs) {
  const data = await hlPost({
    type: 'userFunding',
    user: wallet,
    startTime: startMs,
    endTime: endMs,
  });
  return Array.isArray(data) ? data : [];
}

async function getClearinghouseState(wallet) {
  const data = await hlPost({ type: 'clearinghouseState', user: wallet });
  return data || {};
}

module.exports = { getUserFills, getUserFunding, getClearinghouseState };
