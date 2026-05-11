import type { FastifyRequest } from 'fastify';
import type { IAuthUser } from '../modules/auth/models/auth.model';

declare module 'fastify' {
  interface FastifyRequest {
    user?: IAuthUser;
    accessToken?: string;
  }
}