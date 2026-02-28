require('dotenv').config();

const config = {
  // Server Configuration
  PORT: process.env.PORT || 3000,

  // WhatsApp/Meta Configuration
  PHONE_NUMBER_ID: process.env.PHONE_NUMBER_ID,
  WHATSAPP_TOKEN: process.env.WHATSAPP_TOKEN,
  META_APP_SECRET: process.env.META_APP_SECRET || 'placeholder_secret_para_dev',
  VERIFY_TOKEN: process.env.VERIFY_TOKEN,

  // Owner and Bot Numbers
  OWNER_NUMBER: process.env.OWNER_NUMBER,
  BOT_NUMBER: process.env.BOT_NUMBER,

  // AI Configuration
  GEMINI_API_KEY: process.env.GEMINI_API_KEY,

  // Database Configuration
  SUPABASE_URL: process.env.SUPABASE_URL,
  SUPABASE_KEY: process.env.SUPABASE_KEY,

  // Panel Dashboard Admin Config
  ADMIN_API_KEY: process.env.ADMIN_API_KEY || 'super_secret_admin_key_123',

  // Rate Limiting Configuration
  RATE_LIMIT: {
    WINDOW_MS: 30000, // 30 seconds
    MAX_MESSAGES: 10,
  },

  // Timezone
  TIMEZONE: 'America/Bogota',
};

module.exports = config;
