import dotenv from 'dotenv'

dotenv.config()

const config = {
  env: process.env.NODE_ENV ?? 'development',
  host: process.env.HOST ?? '0.0.0.0',
  port: Number(process.env.PORT ?? 8150),
  corsOrigin: process.env.CORS_ORIGIN ?? '*',
  jwtSecret: process.env.JWT_SECRET ?? 'dev-secret-change-me',
  llm: {
    provider: process.env.LLM_PROVIDER ?? 'mock',
    apiKey: process.env.LLM_API_KEY ?? '',
    baseUrl: process.env.LLM_BASE_URL ?? 'https://api.deepseek.com',
    model: process.env.LLM_MODEL ?? 'deepseek-chat'
  },
  vlm: {
    enabled: process.env.VLM_ENABLED === 'true',
    provider: process.env.VLM_PROVIDER ?? 'openai',
    apiKey: process.env.VLM_API_KEY ?? '',
    baseUrl: process.env.VLM_BASE_URL ?? 'https://api.openai.com/v1',
    model: process.env.VLM_MODEL ?? 'gpt-4o'
  },
  mineru: {
    baseUrl: process.env.MINERU_BASE_URL ?? 'https://mineru.net/api/v4',
    apiKey: process.env.MINERU_API_KEY ?? '',
    mock: process.env.MINERU_MOCK === 'true'
  },
  quota: {
    dailyLimit: Number(process.env.DAILY_QUOTA ?? 1000)
  },
  rateLimit: {
    max: Number(process.env.RATE_LIMIT_MAX ?? 100),
    timeWindow: process.env.RATE_LIMIT_WINDOW ?? '1 minute'
  }
}

export default config
