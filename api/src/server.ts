import { createApp } from './app.js';
import { env } from './config/env.js';
import { logger } from './utils/logger.js';

const app = createApp();

app.listen(env.PORT, () => {
  logger.info(`RoomSync API ${env.PORT} portunda çalışıyor (env: ${env.NODE_ENV})`);
});
