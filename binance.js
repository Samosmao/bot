/**
 * binance.js — Binance REST API client
 * Fetches: price, klines (candles), 24h ticker, order book depth
 * No authentication required for public market data.
 */

const axios = require("axios");
const { config } = require("./config");

const BASE = config.binance.baseUrl;

// Retry helper — retries up to `retries` times on network/5xx errors
async function withRetry(fn, retries = 3, delayMs = 500) {
  let lastErr;
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (i < retries - 1) await sleep(delayMs * (i + 1));
    }
  }
  throw lastErr;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Get current price for a symbol
 * @param {string} symbol  e.g. "BTCUSDT"
 * @returns {Promise<number>}
 */
async function getPrice(symbol) {
  const res = await withRetry(() =>
    axios.get(`${BASE}/api/v3/ticker/price`, { params: { symbol }, timeout: 8000 })
  );
  return parseFloat(res.data.price);
}

/**
 * Get OHLCV klines (candles)
 * @param {string} symbol
 * @param {string} interval  "1m" | "5m" | "15m" | "1h" | "4h" | "1d"
 * @param {number} limit     Number of candles (max 1000)
 * @returns {Promise<Array<{open,high,low,close,volume,openTime,closeTime}>>}
 */
async function getKlines(symbol, interval = "15m", limit = 100) {
  const res = await withRetry(() =>
    axios.get(`${BASE}/api/v3/klines`, {
      params: { symbol, interval, limit },
      timeout: 10000,
    })
  );

  return res.data.map((k) => ({
    openTime: k[0],
    open: parseFloat(k[1]),
    high: parseFloat(k[2]),
    low: parseFloat(k[3]),
    close: parseFloat(k[4]),
    volume: parseFloat(k[5]),
    closeTime: k[6],
  }));
}

/**
 * Get 24-hour ticker stats
 * @param {string} symbol
 * @returns {Promise<Object>}
 */
async function get24hTicker(symbol) {
  const res = await withRetry(() =>
    axios.get(`${BASE}/api/v3/ticker/24hr`, { params: { symbol }, timeout: 8000 })
  );
  const d = res.data;
  return {
    symbol: d.symbol,
    priceChange: parseFloat(d.priceChange),
    priceChangePct: parseFloat(d.priceChangePercent),
    highPrice: parseFloat(d.highPrice),
    lowPrice: parseFloat(d.lowPrice),
    volume: parseFloat(d.volume),
    quoteVolume: parseFloat(d.quoteVolume),
    lastPrice: parseFloat(d.lastPrice),
    openPrice: parseFloat(d.openPrice),
  };
}

/**
 * Fetch complete market snapshot for a symbol across multiple timeframes
 * @param {string} symbol
 * @returns {Promise<Object>}
 */
async function getMarketSnapshot(symbol) {
  const [price, klines1m, klines5m, klines15m, ticker24h] = await Promise.all([
    getPrice(symbol),
    getKlines(symbol, "1m", 60),
    getKlines(symbol, "5m", 60),
    getKlines(symbol, "15m", 60),
    get24hTicker(symbol),
  ]);

  return {
    symbol,
    price,
    ticker24h,
    klines: {
      "1m": klines1m,
      "5m": klines5m,
      "15m": klines15m,
    },
  };
}

module.exports = { getPrice, getKlines, get24hTicker, getMarketSnapshot };