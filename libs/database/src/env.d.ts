declare namespace NodeJS {
  interface ProcessEnv {
    NODE_ENV: 'development' | 'production' | 'test';
    NODE_APP_INSTANCE?: string;
    // thêm tất cả các biến env khác từ .env.example của bạn
    DB_HOST: string;
    DB_PORT: string;
    DB_USERNAME: string;
    DB_PASSWORD: string;
    DB_DATABASE: string;
    TEST:string;
    npm_lifecycle_event: string;
    JWT_SECRET:string;
    REDIS_URL?: string;
    STRIPE_SECRET_KEY?: string;
    FRONTEND_URL?: string;
    STRIPE_DISCOUNT_ID?: string;
  }
}