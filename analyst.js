/**
 * analyst.js — Core analysis orchestrator
 * Combines Binance data → indicators → Groq AI → formatted signal
 */

const { getMarketSnapshot } = require("./binance");
const { buildIndicators } = require("./utils/indicators");
const { getGroqSignal } = require("./groq");
const { formatSignalMessage, formatAlertMessage } = require("./utils/formatter");

/**
 * Run full analysis pipeline for a symbol
 * @param {string} symbol
 * @returns {Promise<string>}  Telegram-ready message
 */
async function runAnalysis(symbol) {
  // 1. Fetch market data
  const snapshot = await getMarketSnapshot(symbol);
  const { price, ticker24h, klines } = snapshot;

  // 2. Calculate indicators for each timeframe
  const indicators = {
    "1m": buildIndicators(klines["1m"], "1m"),
    "5m": buildIndicators(klines["5m"], "5m"),
    "15m": buildIndicators(klines["15m"], "15m"),
  };

  // 3. Pre-flight signal rules (local logic — fast and free)
  const preSignal = preFlightSignal(indicators);

  // 4. Call Groq AI for deep analysis
  const aiSignal = await getGroqSignal(symbol, price, indicators, ticker24h);

  // 5. Merge pre-flight hints with AI signal (AI takes precedence)
  const finalSignal = {
    ...aiSignal,
    // If AI says LONG/SHORT but pre-flight strongly disagrees, override to NO TRADE
    ...(preSignal === "NO TRADE" && aiSignal.confidence < 60
      ? { direction: "NO TRADE", reason: "Conflicting signals; AI confidence too low. " + aiSignal.reason }
      : {}),
  };

  // 6. Format and return
  return formatSignalMessage(finalSignal, symbol);
}

/**
 * Local pre-flight signal check using indicator rules
 * Returns directional hint without requiring AI call
 * @param {Object} indicators
 * @returns {"LONG"|"SHORT"|"NO TRADE"}
 */
function preFlightSignal(indicators) {
  const tf15 = indicators["15m"];
  const tf5 = indicators["5m"];

  const rsi = tf15.rsi ?? tf5.rsi;
  const macd = tf15.macd;
  const volumeSpike = tf15.volume?.isSpike || tf5.volume?.isSpike;

  let longScore = 0;
  let shortScore = 0;

  // RSI signals
  if (rsi !== null) {
    if (rsi < 30) longScore += 2;
    else if (rsi < 40) longScore += 1;
    if (rsi > 70) shortScore += 2;
    else if (rsi > 60) shortScore += 1;
  }

  // MACD crossover
  if (macd.crossover === "BULLISH") longScore += 2;
  if (macd.crossover === "BEARISH") shortScore += 2;

  // MACD histogram direction
  if (macd.histogram > 0) longScore += 1;
  if (macd.histogram < 0) shortScore += 1;

  // Volume confirmation
  if (volumeSpike) {
    longScore *= 1.2;
    shortScore *= 1.2;
  }

  if (longScore >= 3 && longScore > shortScore) return "LONG";
  if (shortScore >= 3 && shortScore > longScore) return "SHORT";
  return "NO TRADE";
}

/**
 * Check for pump/dump alert condition
 * @param {string} symbol
 * @param {Object} klines
 * @param {number} price
 * @returns {{ alert: boolean, type: string|null, message: string|null }}
 */
function checkAlertCondition(symbol, klines, price) {
  const pd15 = klines["15m"]
    ? require("./utils/indicators").detectPumpDump(klines["15m"], 2)
    : { type: null };
  const pd5 = klines["5m"]
    ? require("./utils/indicators").detectPumpDump(klines["5m"], 1.5)
    : { type: null };

  const event = pd15.type ? pd15 : pd5.type ? pd5 : null;

  if (!event) return { alert: false, type: null, message: null };

  return {
    alert: true,
    type: event.type,
    message: formatAlertMessage(symbol, event.type, event.pct, price),
  };
}

/**
 * Start auto-mode interval — runs analysis and optionally sends pump/dump alerts
 * @param {Object} bot         node-telegram-bot-api instance
 * @param {number} chatId
 * @param {string} symbol
 * @param {number} intervalMin
 * @returns {NodeJS.Timeout}
 */
function startAutoMode(bot, chatId, symbol, intervalMin) {
  const ms = intervalMin * 60 * 1000;

  const run = async () => {
    try {
      // Check for pump/dump first (lighter call)
      const snapshot = await getMarketSnapshot(symbol);
      const alertResult = checkAlertCondition(symbol, snapshot.klines, snapshot.price);

      if (alertResult.alert) {
        await bot.sendMessage(chatId, alertResult.message, { parse_mode: "Markdown" });
      }

      // Full signal
      const indicators = {
        "1m": buildIndicators(snapshot.klines["1m"], "1m"),
        "5m": buildIndicators(snapshot.klines["5m"], "5m"),
        "15m": buildIndicators(snapshot.klines["15m"], "15m"),
      };

      const aiSignal = await getGroqSignal(
        symbol,
        snapshot.price,
        indicators,
        snapshot.ticker24h
      );

      // Only send if not NO TRADE, or if it's been explicitly requested
      if (aiSignal.direction !== "NO TRADE") {
        const message = formatSignalMessage(aiSignal, symbol);
        await bot.sendMessage(chatId, message, { parse_mode: "Markdown" });
      } else {
        await bot.sendMessage(
          chatId,
          `⚪ *NO TRADE* — ${symbol}\n_Market unclear. Waiting for better setup._`,
          { parse_mode: "Markdown" }
        );
      }
    } catch (err) {
      console.error(`[auto-mode][${symbol}]`, err.message);
      bot.sendMessage(chatId, `⚠️ Auto scan error for ${symbol}: ${err.message}`);
    }
  };

  // Run immediately on start
  run();

  return setInterval(run, ms);
}

/**
 * Stop auto-mode interval
 * @param {NodeJS.Timeout} intervalId
 */
function stopAutoMode(intervalId) {
  clearInterval(intervalId);
}

module.exports = { runAnalysis, startAutoMode, stopAutoMode, preFlightSignal };