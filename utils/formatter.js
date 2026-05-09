/**
 * utils/formatter.js — Format parsed AI signals into Telegram messages
 */

/**
 * Build a Telegram-safe Markdown message from a parsed signal
 * @param {Object} signal
 * @param {string} symbol
 * @returns {string}
 */
function formatSignalMessage(signal, symbol) {
  const {
    direction,
    entry,
    tp1,
    tp2,
    tp3,
    sl,
    rr,
    confidence,
    reason,
  } = signal;

  const dirIcon =
    direction === "LONG" ? "🟢" : direction === "SHORT" ? "🔴" : "⚪";

  const rrDisplay = rr ? `⚖️ *R:R* ${rr}` : "";

  return (
    `${dirIcon} *Signal: ${direction}* — \`${symbol}\`\n` +
    `━━━━━━━━━━━━━━━━━━━━━\n` +
    `💰 *Entry:* \`${entry}\`\n` +
    `🎯 *TP1:* \`${tp1}\`\n` +
    `🎯 *TP2:* \`${tp2 || "—"}\`\n` +
    `🎯 *TP3:* \`${tp3 || "—"}\`\n` +
    `🛑 *SL:* \`${sl}\`\n` +
    (rrDisplay ? `${rrDisplay}\n` : "") +
    `🔥 *Confidence:* ${confidence}%\n` +
    `━━━━━━━━━━━━━━━━━━━━━\n` +
    `📉 *Analysis:*\n${reason}\n` +
    `━━━━━━━━━━━━━━━━━━━━━\n` +
    `_⚠️ Not financial advice. DYOR._`
  );
}

/**
 * Format a pump/dump alert
 * @param {string} symbol
 * @param {"PUMP"|"DUMP"} type
 * @param {number} pct
 * @param {number} price
 * @returns {string}
 */
function formatAlertMessage(symbol, type, pct, price) {
  const icon = type === "PUMP" ? "🚀" : "📉";
  const direction = type === "PUMP" ? "LONG" : "SHORT";
  return (
    `${icon} *${type} ALERT — ${symbol}*\n` +
    `━━━━━━━━━━━━━━━━━━━━━\n` +
    `📊 Move: *${pct > 0 ? "+" : ""}${pct}%* in last 10 candles\n` +
    `💵 Current Price: \`${price}\`\n` +
    `🔔 Suggested Direction: *${direction}*\n` +
    `━━━━━━━━━━━━━━━━━━━━━\n` +
    `_Use /signal ${symbol} for a full AI analysis_`
  );
}

/**
 * Format the indicator summary for debugging / verbose mode
 */
function formatIndicators(indicators, symbol, price) {
  const { rsi, macd, ema, volume, pumpDump, timeframe } = indicators;
  return (
    `📊 *${symbol} [${timeframe}]* @ \`${price}\`\n` +
    `RSI: ${rsi ?? "N/A"} | MACD: ${macd.crossover ?? "none"}\n` +
    `EMA9: ${ema.ema9 ?? "—"} | EMA21: ${ema.ema21 ?? "—"} | EMA50: ${ema.ema50 ?? "—"}\n` +
    `Volume spike: ${volume?.isSpike ? `Yes (${volume.spikeRatio}x)` : "No"}\n` +
    `Pump/Dump: ${pumpDump.type ?? "None"} (${pumpDump.pct}%)`
  );
}

module.exports = { formatSignalMessage, formatAlertMessage, formatIndicators };