import { Router } from 'express';

import { authenticate } from '../../middleware/auth.middleware.js';
import { validate } from '../../middleware/validate.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import * as authController from './auth.controller.js';
import { loginSchema, registerSchema } from './auth.schema.js';

// Not: login'e özel sıkı rate limit burada DEĞİL, app.ts'te (createApp() içinde)
// uygulanır. authRouter modül seviyesinde bir singleton olduğundan, middleware'i
// burada oluşturmak onu process ömrü boyunca tek bir instance'a sabitlerdi;
// bu da her testte createApp() ile "temiz" bir uygulama alma varsayımını bozar.
export const authRouter = Router();

authRouter.post('/register', validate(registerSchema), asyncHandler(authController.handleRegister));
authRouter.post('/login', validate(loginSchema), asyncHandler(authController.handleLogin));
authRouter.post('/refresh', asyncHandler(authController.handleRefresh));
authRouter.post('/logout', authenticate, asyncHandler(authController.handleLogout));
