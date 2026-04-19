function required(key: string): string {
  const val = process.env[key];
  if (!val) throw new Error(`Missing required environment variable: ${key}`);
  return val;
}

export const env = {
  databaseUrl:     required('DATABASE_URL'),
  redisUrl:        process.env.REDIS_URL ?? 'redis://localhost:6379',
  jwtSecret:       required('JWT_SECRET'),
  jwtAccessTtl:    parseInt(process.env.JWT_ACCESS_TTL_SECONDS ?? '900'),
  jwtRefreshTtlDays: parseInt(process.env.JWT_REFRESH_TTL_DAYS ?? '30'),
  stripeSecretKey: process.env.STRIPE_SECRET_KEY ?? '',
  openaiApiKey:    process.env.OPENAI_API_KEY ?? '',
  sendgridApiKey:  process.env.SENDGRID_API_KEY ?? '',
  webBaseUrl:      process.env.WEB_BASE_URL ?? 'http://localhost:5173',
  port:            parseInt(process.env.PORT ?? '3000'),
  nodeEnv:         process.env.NODE_ENV ?? 'development',
  corsOrigin:      process.env.CORS_ORIGIN ?? 'http://localhost:5173',
};
