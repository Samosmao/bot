/**
 * bot.js — Main entry point
 * Telegram Trading Signal Bot
 */

require("dotenv").config();
const { initTelegram } = require("./telegram");
const { startAutoMode, stopAutoMode } = require("./analyst");
const { validateEnv } = require("./config");

// Validate environment before starting
validateEnv();

const bot = initTelegram();

// Track auto-mode state per chat
const autoSessions = new Map();

// ─── /start ────────────────────────────────────────────────────────────────
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(
    chatId,
    `🤖 *Crypto Signal Bot — Online*\n\n` +
      `Powered by Binance + Groq AI\n\n` +
      `Commands:\n` +
      `• /signal — Generate signal now\n` +
      `• /auto — Start auto-scan (every ${process.env.AUTO_INTERVAL_MIN || 5} min)\n` +
      `• /stop — Stop auto mode\n` +
      `• /symbols — List tracked symbols\n\n` +
      `_Trading involves risk. Always use proper risk management._`,
    { parse_mode: "Markdown" }
  );
});

// ─── /signal ───────────────────────────────────────────────────────────────
bot.onText(/\/signal(?:\s+(\S+))?/, async (msg, match) => {
  const chatId = msg.chat.id;

  if (!isAllowed(msg.from.id)) {
    return bot.sendMessage(chatId, "⛔ Unauthorized.");
  }

  const symbol = (match[1] || process.env.DEFAULT_SYMBOL || "BTCUSDT").toUpperCase();
  await bot.sendMessage(chatId, `🔍 Analyzing *${symbol}*...`, { parse_mode: "Markdown" });

  try {
    const { runAnalysis } = require("./analyst");
    const signal = await runAnalysis(symbol);
    bot.sendMessage(chatId, signal, { parse_mode: "Markdown" });
  } catch (err) {
    console.error("[/signal]", err.message);
    bot.sendMessage(chatId, `❌ Analysis failed: ${err.message}`);
  }
});

// ─── /auto ─────────────────────────────────────────────────────────────────
bot.onText(/\/auto(?:\s+(\S+))?/, (msg, match) => {
  const chatId = msg.chat.id;

  if (!isAllowed(msg.from.id)) {
    return bot.sendMessage(chatId, "⛔ Unauthorized.");
  }

  if (autoSessions.has(chatId)) {
    return bot.sendMessage(chatId, "⚠️ Auto mode is already running. Use /stop first.");
  }

  const symbol = (match[1] || process.env.DEFAULT_SYMBOL || "BTCUSDT").toUpperCase();
  const intervalMin = parseInt(process.env.AUTO_INTERVAL_MIN || "5", 10);

  bot.sendMessage(
    chatId,
    `✅ Auto mode started for *${symbol}*\nScanning every *${intervalMin} minutes*.\nUse /stop to cancel.`,
    { parse_mode: "Markdown" }
  );

  const intervalId = startAutoMode(bot, chatId, symbol, intervalMin);
  autoSessions.set(chatId, intervalId);
});

// ─── /stop ─────────────────────────────────────────────────────────────────
bot.onText(/\/stop/, (msg) => {
  const chatId = msg.chat.id;

  if (!autoSessions.has(chatId)) {
    return bot.sendMessage(chatId, "ℹ️ No active auto session.");
  }

  stopAutoMode(autoSessions.get(chatId));
  autoSessions.delete(chatId);
  bot.sendMessage(chatId, "🛑 Auto mode stopped.");
});

// ─── /symbols ──────────────────────────────────────────────────────────────
bot.onText(/\/symbols/, (msg) => {
  const symbols = (process.env.WATCH_SYMBOLS || "BTCUSDT,ETHUSDT,BNBUSDT").split(",");
  bot.sendMessage(
    msg.chat.id,
    `📋 *Tracked Symbols:*\n${symbols.map((s) => `• ${s}`).join("\n")}`,
    { parse_mode: "Markdown" }
  );
});

// ─── Helpers ───────────────────────────────────────────────────────────────
function isAllowed(userId) {
  const allowed = process.env.ALLOWED_USER_IDS;
  if (!allowed) return true; // open mode — restrict in production!
  return allowed.split(",").map((id) => id.trim()).includes(String(userId));
}

// ─── Rate limiting (simple in-memory) ─────────────────────────────────────
const rateLimiter = new Map();
bot.on("message", (msg) => {
  const userId = msg.from?.id;
  if (!userId) return;

  const now = Date.now();
  const last = rateLimiter.get(userId) || 0;
  if (now - last < 2000) {
    // 2-second cooldown per user
    return;
  }
  rateLimiter.set(userId, now);
});

console.log("🚀 Telegram Trading Bot started.");