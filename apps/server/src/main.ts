import { createApp } from './app.js';
import { readConfig } from './config/env.js';

const config = readConfig();
const { app } = await createApp(config);

const shutdown = async () => { await app.close(); process.exit(0); };
process.on('SIGINT', () => void shutdown());
process.on('SIGTERM', () => void shutdown());

try { await app.listen({ host: config.host, port: config.port }); }
catch (error) { app.log.error(error); process.exit(1); }
