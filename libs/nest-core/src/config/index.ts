import { LogLevel } from 'fastify'
import { AppConfig, appRegToken, IAppConfig } from './app.config'
import { AppScopeConfig, appScopeRegToken, IAppScopeConfig } from './app-scope.config'
import { DatabaseConfig, dbRegToken, IDatabaseConfig } from './database.config'
import { IMailerConfig, MailerConfig, mailerRegToken } from './mailer.config'
import { IOssConfig, OssConfig, ossRegToken } from './oss.config'
import { IRedisConfig, RedisConfig, redisRegToken } from './redis.config'
import { ISecurityConfig, SecurityConfig, securityRegToken } from './security.config'
import { ISwaggerConfig, SwaggerConfig, swaggerRegToken } from './swagger.config'

export * from './app.config'
export * from './app-scope.config'
export * from './database.config'
export * from './mailer.config'
export * from './oss.config'
export * from './redis.config'
export * from './security.config'
export * from './swagger.config'

export interface AllConfigType {
  [appRegToken]: IAppConfig
  [appScopeRegToken]: IAppScopeConfig
  [dbRegToken]: IDatabaseConfig
  [mailerRegToken]: IMailerConfig
  [redisRegToken]: IRedisConfig
  [securityRegToken]: ISecurityConfig
  [swaggerRegToken]: ISwaggerConfig
  [ossRegToken]: IOssConfig
  // app: IAppConfig;
  // logger: { level: LogLevel; maxFiles: number };
  // mailer: IMailerConfig;
  // redis: IRedisConfig;
}

export type RecordNamePaths<T> = {
  [K in keyof T]: T[K] extends Record<string, any>
    ? `${Extract<K, string>}.${RecordNamePaths<T[K]>}`
    : Extract<K, string>;
}[keyof T];

export type ConfigKeyPaths = RecordNamePaths<AllConfigType>

export default {
  AppConfig,
  AppScopeConfig,
  DatabaseConfig,
  MailerConfig,
  OssConfig,
  RedisConfig,
  SecurityConfig,
  SwaggerConfig,
}
