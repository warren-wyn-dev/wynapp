import { pool } from '../../../packages/database/src/index.js'; import { buildApp } from './app.js'; import { DevelopmentEmailAdapter, ProductionEmailAdapter } from './email.js';
const email=process.env.NODE_ENV==='production'?new ProductionEmailAdapter():new DevelopmentEmailAdapter(); const app=await buildApp({pool,email}); await app.listen({port:Number(process.env.PORT??4000),host:'0.0.0.0'});
