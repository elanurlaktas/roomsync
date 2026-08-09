import cookieParser from 'cookie-parser';
import cors from 'cors';
import express, { type Express } from 'express';
import { pinoHttp } from 'pino-http';
import swaggerUi from 'swagger-ui-express';

import { env } from './config/env.js';
import { generateOpenApiDocument } from './docs/openapi.js';
import { errorHandler, notFoundHandler } from './middleware/error.middleware.js';
import { createGeneralRateLimiter, createLoginRateLimiter } from './middleware/rateLimit.js';
import { authRouter } from './modules/auth/auth.routes.js';
import { bookingsRouter } from './modules/bookings/bookings.routes.js';
import { roomsRouter } from './modules/rooms/rooms.routes.js';
import { logger } from './utils/logger.js';

// Modül seviyesinde bir kez üretilir (route/şema tanımları statiktir) — her
// createApp() çağrısında (örn. her testte) yeniden üretmek gereksiz iştir.
const openApiDocument = generateOpenApiDocument();

export function createApp(): Express {
  const app = express();

  // ⚠️ Bölüm 20 — nginx tuzağı: bu ayar olmadan, nginx arkasında deploy edildikten
  // sonra Express tüm istekleri proxy'nin IP'sinden geliyormuş sanır ve aşağıdaki
  // rate limiter tüm kullanıcıları tek kişi sayıp hepsini birden kilitler. `1`
  // değeri "sadece bir sonraki hop'a (nginx) güven" anlamına gelir; istemcinin
  // kendi göndereceği X-Forwarded-For'a güvenilmez (bu yüzden `true` DEĞİL, `1`).
  app.set('trust proxy', 1);

  app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }));
  app.use(express.json());
  app.use(cookieParser());
  app.use(pinoHttp({ logger }));

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  // /health gibi, dokümantasyon da genel rate limitin dışında tutulur —
  // Swagger UI'ı gezen bir işveren/reviewer'ın 429 alması istenmez (Bölüm 17, Faz 5).
  app.get('/api-docs.json', (_req, res) => {
    res.json(openApiDocument);
  });
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(openApiDocument));

  // Health/docs'tan sonra, gerçek endpoint'lerden önce: genel rate limit.
  app.use(createGeneralRateLimiter());

  // Login için ek, daha sıkı limit (Bölüm 17, Faz 4). authRouter modül seviyesinde
  // tanımlı bir singleton olduğundan, bu limiter route'un kendisine değil, burada
  // her createApp() çağrısında taze bir instance olacak şekilde path bazlı
  // mount edilir.
  app.use('/auth/login', createLoginRateLimiter());

  app.use('/auth', authRouter);
  app.use('/rooms', roomsRouter);
  app.use('/bookings', bookingsRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
