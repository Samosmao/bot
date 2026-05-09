/**
 * config.js — Central config & env validation
 */

const REQUIRED_ENV = [
  "TELEGRAM_BOT_TOKEN",
  "GROQ_API_KEY",
];

function validateEnv() {
  const missing = REQUIRED_ENV.filter((k) => !process.env[k]);
  if (missing.length > 0) {
    console.error(`❌ Missing required environment variables:\n  ${missing.join("\n  ")}`);
    process.exit(1);
  }
  console.log("✅ Environment validated.");
}

const config = {
  telegram: {
    token: process.env.TELEGRAM_BOT_TOKEN,
  },
  groq: {
    apiKey: process.env.GROQ_API_KEY,
    model: process.env.GROQ_MODEL || "llama3-70b-8192",
    maxTokens: 800,
  },
  binance: {
    baseUrl: "https://api.binance.com",
    // Optional signed endpoints (not needed for public market data)
    apiKey: process.env.BINANCE_API_KEY || null,
    apiSecret: process.env.BINANCE_API_SECRET || null,
  },
  bot: {
    defaultSymbol: process.env.DEFAULT_SYMBOL || "BTCUSDT",
    autoIntervalMin: parseInt(process.env.AUTO_INTERVAL_MIN || "5", 10),
    watchSymbols: (process.env.WATCH_SYMBOLS || "BTCUSDT,ETHUSDT,BNBUSDT").split(","),
    allowedUserIds: process.env.ALLOWED_USER_IDS
      ? process.env.ALLOWED_USER_IDS.split(",").map((id) => id.trim())
      : [],
  },
};

module.exports = { config, validateEnv };