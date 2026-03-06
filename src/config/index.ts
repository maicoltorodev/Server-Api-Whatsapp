import dotenv from 'dotenv';
dotenv.config();

export const config = {
  // Server Configuration
  PORT: process.env.PORT || 3000,

  // WhatsApp/Meta Configuration
  PHONE_NUMBER_ID: process.env.PHONE_NUMBER_ID,
  WHATSAPP_TOKEN: process.env.WHATSAPP_TOKEN,
  META_APP_SECRET: process.env.META_APP_SECRET || 'placeholder_secret_para_dev',
  VERIFY_TOKEN: process.env.VERIFY_TOKEN,

  // AI Configuration
  GEMINI_API_KEY: process.env.GEMINI_API_KEY,

  // Database Configuration
  SUPABASE_URL: process.env.SUPABASE_URL,
  SUPABASE_KEY: process.env.SUPABASE_KEY,

  // Panel Dashboard Admin Config
  ADMIN_API_KEY: process.env.ADMIN_API_KEY || 'super_secret_admin_key_123',
  FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:3000',

  // Rate Limiting Configuration
  RATE_LIMIT: {
    WINDOW_MS: 30000, // 30 seconds
    MAX_MESSAGES: 10,
  },

  // Timezone
  TIMEZONE: 'America/Bogota',
};

export default config;

