/**
 * utils/indicators.js — Technical indicator calculations
 * Pure functions: RSI, MACD, EMA, volume analysis
 */

/**
 * Calculate EMA (Exponential Moving Average)
 * @param {number[]} closes
 * @param {number} period
 * @returns {number[]}
 */
function calcEMA(closes, period) {
  if (closes.length < period) return [];
  const k = 2 / (period + 1);
  const result = [];

  // Seed with SMA of first `period` values
  let ema = closes.slice(0, period).reduce((a, b) => a + b, 0) / period;
  result.push(ema);

  for (let i = period; i < closes.length; i++) {
    ema = closes[i] * k + ema * (1 - k);
    result.push(ema);
  }
  return result;
}

/**
 * Calculate RSI (Relative Strength Index)
 * @param {number[]} closes
 * @param {number} period  default 14
 * @returns {number} RSI value 0–100
 */
function calcRSI(closes, period = 14) {
  if (closes.length < period + 1) return null;

  let gains = 0;
  let losses = 0;

  for (let i = 1; i <= period; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff >= 0) gains += diff;
    else losses += Math.abs(diff);
  }

  let avgGain = gains / period;
  let avgLoss = losses / period;

  for (let i = period + 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    const gain = diff >= 0 ? diff : 0;
    const loss = diff < 0 ? Math.abs(diff) : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
  }

  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return parseFloat((100 - 100 / (1 + rs)).toFixed(2));
}

/**
 * Calculate MACD
 * @param {number[]} closes
 * @param {number} fastPeriod   default 12
 * @param {number} slowPeriod   default 26
 * @param {number} signalPeriod default 9
 * @returns {{ macd: number, signal: number, histogram: number, crossover: string|null }}
 */
function calcMACD(closes, fastPeriod = 12, slowPeriod = 26, signalPeriod = 9) {
  const emaFast = calcEMA(closes, fastPeriod);
  const emaSlow = calcEMA(closes, slowPeriod);

  // Align: emaSlow is shorter, align from end
  const diff = emaFast.length - emaSlow.length;
  const macdLine = emaSlow.map((slow, i) => emaFast[i + diff] - slow);

  if (macdLine.length < signalPeriod) {
    return { macd: null, signal: null, histogram: null, crossover: null };
  }

  const signalLine = calcEMA(macdLine, signalPeriod);
  const lastMACD = macdLine[macdLine.length - 1];
  const lastSignal = signalLine[signalLine.length - 1];
  const prevMACD = macdLine[macdLine.length - 2];
  const prevSignal = signalLine[signalLine.length - 2];

  const histogram = lastMACD - lastSignal;

  // Detect crossovers
  let crossover = null;
  if (prevMACD !== undefined && prevSignal !== undefined) {
    if (prevMACD < prevSignal && lastMACD > lastSignal) crossover = "BULLISH";
    if (prevMACD > prevSignal && lastMACD < lastSignal) crossover = "BEARISH";
  }

  return {
    macd: parseFloat(lastMACD.toFixed(6)),
    signal: parseFloat(lastSignal.toFixed(6)),
    histogram: parseFloat(histogram.toFixed(6)),
    crossover,
  };
}

/**
 * Volume analysis — detect spike vs average
 * @param {Array<{volume: number}>} klines
 * @param {number} lookback  candles to average
 * @returns {{ avgVolume: number, lastVolume: number, spikeRatio: number, isSpike: boolean }}
 */
function analyzeVolume(klines, lookback = 20) {
  if (klines.length < lookback + 1) return null;

  const volumes = klines.map((k) => k.volume);
  const recent = volumes.slice(-lookback - 1);
  const avgVolume = recent.slice(0, lookback).reduce((a, b) => a + b, 0) / lookback;
  const lastVolume = recent[recent.length - 1];
  const spikeRatio = avgVolume > 0 ? lastVolume / avgVolume : 1;

  return {
    avgVolume: parseFloat(avgVolume.toFixed(2)),
    lastVolume: parseFloat(lastVolume.toFixed(2)),
    spikeRatio: parseFloat(spikeRatio.toFixed(2)),
    isSpike: spikeRatio >= 1.5,
  };
}

/**
 * Detect pump or dump based on recent price action
 * @param {Array<{close: number}>} klines
 * @param {number} pctThreshold  default 2% move in last candle window
 * @returns {{ type: "PUMP"|"DUMP"|null, pct: number }}
 */
function detectPumpDump(klines, pctThreshold = 2) {
  if (klines.length < 10) return { type: null, pct: 0 };
  const window = klines.slice(-10);
  const start = window[0].close;
  const end = window[window.length - 1].close;
  const pct = ((end - start) / start) * 100;

  if (pct >= pctThreshold) return { type: "PUMP", pct: parseFloat(pct.toFixed(2)) };
  if (pct <= -pctThreshold) return { type: "DUMP", pct: parseFloat(pct.toFixed(2)) };
  return { type: null, pct: parseFloat(pct.toFixed(2)) };
}

/**
 * Build a full indicator summary from klines
 * @param {Array} klines
 * @param {string} tf   timeframe label
 * @returns {Object}
 */
function buildIndicators(klines, tf) {
  const closes = klines.map((k) => k.close);
  const rsi = calcRSI(closes);
  const macd = calcMACD(closes);
  const ema9 = calcEMA(closes, 9);
  const ema21 = calcEMA(closes, 21);
  const ema50 = calcEMA(closes, 50);
  const volume = analyzeVolume(klines);
  const pumpDump = detectPumpDump(klines);

  return {
    timeframe: tf,
    rsi,
    macd,
    ema: {
      ema9: ema9.length ? parseFloat(ema9[ema9.length - 1].toFixed(4)) : null,
      ema21: ema21.length ? parseFloat(ema21[ema21.length - 1].toFixed(4)) : null,
      ema50: ema50.length ? parseFloat(ema50[ema50.length - 1].toFixed(4)) : null,
    },
    volume,
    pumpDump,
  };
}

module.exports = { calcRSI, calcMACD, calcEMA, analyzeVolume, detectPumpDump, buildIndicators };