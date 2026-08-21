import 'fastify';
import type { AdminActor } from '../../../packages/admin/src/service.js';
declare module 'fastify' {
  interface FastifyRequest {
    requestId: string;
    auth?: {
      userId: string;
      sessionId: string;
      realm: 'CONSUMER' | 'ADMIN';
      state: string;
    };
    admin?: AdminActor;
  }
}
