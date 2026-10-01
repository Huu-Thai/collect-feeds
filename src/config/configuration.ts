export interface AppConfig {
  env: string;
  port: number;
  database: {
    url: string;
  };
  redis: {
    host: string;
    port: number;
  };
  jwt: {
    secret: string;
    expiresIn: string;
    refreshTokenTtl: string;
  };
}

export default (): AppConfig => ({
  env: process.env.NODE_ENV ?? 'development',
  port: parseInt(process.env.PORT ?? '3000', 10),
  database: {
    url: process.env.DATABASE_URL as string,
  },
  redis: {
    host: process.env.REDIS_HOST as string,
    port: parseInt(process.env.REDIS_PORT ?? '6379', 10),
  },
  jwt: {
    secret: process.env.JWT_SECRET as string,
    expiresIn: process.env.JWT_EXPIRES_IN ?? '15m',
    refreshTokenTtl: process.env.REFRESH_TOKEN_TTL ?? '7d',
  },
});
