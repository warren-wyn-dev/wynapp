import 'fastify';
declare module 'fastify' { interface FastifyRequest { requestId: string; auth?: { userId:string; sessionId:string; realm:'CONSUMER'|'ADMIN'; state:string } } }
