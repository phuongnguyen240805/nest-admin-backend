declare namespace NodeJS {
  interface ProcessEnv {
    NODE_ENV: 'development' | 'production' | 'test';
    NODE_APP_INSTANCE?: string;
    // thêm tất cả các biến env khác từ .env.example của bạn
    DATABASE_URL?: string;
    DB_HOST?: string;
    DB_PORT?: string;
    DB_USERNAME?: string;
    DB_PASSWORD?: string;
    DB_DATABASE?: string;
    DB_LOGGING?: string;
    REDIS_HOST?: string;
    REDIS_PORT?: string;
    REDIS_PASSWORD?: string;
    REDIS_DB?: string;
    TEST:string;
    npm_lifecycle_event: string;
    JWT_SECRET:string;
    REDIS_URL?: string;
    STRIPE_SECRET_KEY?: string;
    FRONTEND_URL?: string;
    STRIPE_DISCOUNT_ID?: string;
    STRIPE_PRICE_PRO_MONTHLY?: string;
    STRIPE_PRICE_PRO_YEARLY?: string;
    STRIPE_PRICE_ENTERPRISE_MONTHLY?: string;
    STRIPE_PRICE_ENTERPRISE_YEARLY?: string;
  }
}