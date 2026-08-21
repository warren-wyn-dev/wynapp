import Fastify, { type FastifyInstance, type FastifyRequest } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import { createRequestId } from '@wyn/observability';
import { requestIdSchema } from '@wyn/validation';
export interface ApiOptions {
  allowedOrigins: readonly string[];
  ready?: () => Promise<boolean>;
}
export type AuthenticationMiddleware = (
  request: FastifyRequest,
) => Promise<void>;
export type AuthorizationPolicy = (
  request: FastifyRequest,
  action: string,
) => Promise<boolean>;
export type RateLimitPolicy = (request: FastifyRequest) => Promise<boolean>;
function clientError(error: unknown): { status: number; message: string } {
  if (
    error instanceof Error &&
    'statusCode' in error &&
    typeof error.statusCode === 'number' &&
    error.statusCode >= 400 &&
    error.statusCode < 500
  ) {
    return { status: error.statusCode, message: error.message };
  }
  return { status: 500, message: 'An unexpected error occurred.' };
}
export async function buildApp(options: ApiOptions): Promise<FastifyInstance> {
  const app = Fastify({
    logger: {
      name: 'api',
      redact: [
        'password',
        'token',
        'cookie',
        'authorization',
        'secret',
        'session',
        'req.headers.authorization',
        'req.headers.cookie',
      ],
    },
    genReqId(request) {
      const incoming = request.headers['x-request-id'];
      return requestIdSchema.safeParse(incoming).success
        ? String(incoming)
        : createRequestId();
    },
    disableRequestLogging: false,
  });
  await app.register(helmet);
  await app.register(cors, {
    credentials: true,
    origin(origin, callback) {
      if (!origin || options.allowedOrigins.includes(origin))
        callback(null, true);
      else callback(new Error('Origin not allowed'), false);
    },
  });
  app.addHook('onRequest', async (request, reply) => {
    const correlation = request.headers['x-correlation-id'];
    const value = requestIdSchema.safeParse(correlation).success
      ? String(correlation)
      : request.id;
    reply.header('x-request-id', request.id).header('x-correlation-id', value);
  });
  app.get('/health', async () => ({ status: 'ok' }));
  app.get('/ready', async (_request, reply) => {
    const ready = await (options.ready?.() ?? Promise.resolve(true));
    if (!ready) return reply.code(503).send({ status: 'not_ready' });
    return { status: 'ready' };
  });
  await app.register(
    async (consumer) => {
      consumer.get('/', async () => ({ namespace: 'v1' }));
    },
    { prefix: '/v1' },
  );
  await app.register(
    async (admin) => {
      admin.get('/', async () => ({ namespace: 'admin/v1' }));
    },
    { prefix: '/admin/v1' },
  );
  app.setNotFoundHandler(async (request, reply) =>
    reply.code(404).send({
      error: {
        code: 'NOT_FOUND',
        message: 'The requested resource is unavailable.',
        requestId: request.id,
      },
    }),
  );
  app.setErrorHandler(async (error, request, reply) => {
    request.log.error({ err: error }, 'request failed');
    const { status, message } = clientError(error);
    return reply.code(status).send({
      error: {
        code: status === 500 ? 'INTERNAL_ERROR' : 'REQUEST_ERROR',
        message,
        requestId: request.id,
      },
    });
  });
  return app;
}
