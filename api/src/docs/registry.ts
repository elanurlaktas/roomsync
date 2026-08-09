import { extendZodWithOpenApi, OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';

// zod-to-openapi'nin ZodType.prototype'a `.openapi()` metodunu eklediği yer.
// Bu modül, docs/ altındaki her şeyden önce (import zinciri üzerinden) çalışır;
// bu sayede aşağıdaki schemas.ts / paths.ts dosyalarında `.openapi()` kullanmak
// mevcut modül şemalarını (auth/rooms/bookings .schema.ts) değiştirmeye gerek
// kalmadan güvenli olur.
extendZodWithOpenApi(z);

export const registry = new OpenAPIRegistry();

export const BEARER_AUTH = 'bearerAuth';

registry.registerComponent('securitySchemes', BEARER_AUTH, {
  type: 'http',
  scheme: 'bearer',
  bearerFormat: 'JWT',
  description:
    "POST /auth/login veya /auth/refresh'ten dönen accessToken, `Authorization: Bearer <token>` başlığıyla gönderilmeli.",
});
