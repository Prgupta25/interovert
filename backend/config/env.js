const env = {
  get nodeEnv() { return globalThis.process.env.NODE_ENV || 'development'; },
  get port() { return Number(globalThis.process.env.PORT || 5000); },
  get mongoUri() { return globalThis.process.env.MONGODB_URI || ''; },
  get pgHost() { return globalThis.process.env.PG_HOST || ''; },
  get pgPort() { return Number(globalThis.process.env.PG_PORT || 5432); },
  get pgUser() { return globalThis.process.env.PG_USER || ''; },
  get pgPassword() { return globalThis.process.env.PG_PASSWORD || ''; },
  get pgDatabase() { return globalThis.process.env.PG_DATABASE || ''; },
  get pgSsl() { return globalThis.process.env.PG_SSL === 'true'; },
  get jwtSecret() { return globalThis.process.env.JWT_SECRET || ''; },
  get emailUser() { return globalThis.process.env.EMAIL_USER || ''; },
  get emailPass() { return globalThis.process.env.EMAIL_PASS || ''; },
  get geminiApiKey() { return globalThis.process.env.GEMINI_API_KEY || ''; },
  get askyApiKey() { return globalThis.process.env.ASKY_API_KEY || ''; },
  get askyBaseUrl() { return globalThis.process.env.ASKY_BASE_URL || 'https://api.asky.ai/v1'; },
  get askyChatEndpoint() { return globalThis.process.env.ASKY_CHAT_ENDPOINT || ''; },
  get askyAuthToken() { return globalThis.process.env.ASKY_AUTH_TOKEN || ''; },
  get askyModel() { return globalThis.process.env.ASKY_MODEL || 'asky-chat'; },
  get askyModelVersion() { return globalThis.process.env.ASKY_MODEL_VERSION || ''; },
  get askyTemporaryChat() { return globalThis.process.env.ASKY_TEMPORARY_CHAT === 'true'; },
  get openAiApiKey() { return globalThis.process.env.OPENAI_API_KEY || ''; },
  get frontendUrl() { return globalThis.process.env.FRONTEND_URL || ''; },
  get enableWhatsappNotifications() { return globalThis.process.env.ENABLE_WHATSAPP_NOTIFICATIONS === 'true'; },
  get twilioAccountSid() { return globalThis.process.env.TWILIO_ACCOUNT_SID || ''; },
  get twilioAuthToken() { return globalThis.process.env.TWILIO_AUTH_TOKEN || ''; },
  get twilioWhatsappFrom() { return globalThis.process.env.TWILIO_WHATSAPP_FROM || ''; },
  get whatsappWebhookUrl() { return globalThis.process.env.WHATSAPP_GROUP_WEBHOOK_URL || ''; },
  get whatsappWebhookToken() { return globalThis.process.env.WHATSAPP_GROUP_WEBHOOK_TOKEN || ''; },
};

export function validateStartupEnv() {
  const missing = ['jwtSecret'].filter((key) => !env[key]);
  const hasMongo = Boolean(env.mongoUri);
  const hasPostgres = Boolean(env.pgHost && env.pgUser && env.pgDatabase);

  if (!hasMongo && !hasPostgres) {
    missing.push('MONGODB_URI or PG_HOST+PG_USER+PG_DATABASE');
  }

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
}

export default env;
