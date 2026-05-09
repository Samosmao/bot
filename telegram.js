/**
 * telegram.js — Telegram bot initialization + error handling
 */

const TelegramBot = require("node-telegram-bot-api");
const { config } = require("./config");

let botInstance = null;

/**
 * Initialize and return the Telegram bot singleton
 * @returns {TelegramBot}
 */
function initTelegram() {
  if (botInstance) return botInstance;

  botInstance = new TelegramBot(config.telegram.token, {
    polling: {
      interval: 300,
      autoStart: true,
      params: { timeout: 10 },
    },
  });

  // Global error handlers — prevent crashes on network blips
  botInstance.on("polling_error", (err) => {
    console.error("[Telegram polling error]", err.code, err.message);
  });

  botInstance.on("error", (err) => {
    console.error("[Telegram bot error]", err.message);
  });

  botInstance.on("webhook_error", (err) => {
    console.error("[Telegram webhook error]", err.message);
  });

  console.log("✅ Telegram bot polling started.");
  return botInstance;
}

/**
 * Send a message with retry on failure
 * @param {number} chatId
 * @param {string} text
 * @param {Object} opts
 */
async function sendSafe(chatId, text, opts = {}) {
  const bot = initTelegram();
  try {
    await bot.sendMessage(chatId, text, opts);
  } catch (err) {
    console.error(`[sendSafe] Failed to send to ${chatId}: ${err.message}`);
    // Retry once after 2s
    setTimeout(async () => {
      try {
        await bot.sendMessage(chatId, text, opts);
      } catch (e) {
        console.error(`[sendSafe] Retry failed: ${e.message}`);
      }
    }, 2000);
  }
}

module.exports = { initTelegram, sendSafe };