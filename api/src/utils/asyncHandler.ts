import type { NextFunction, Request, Response } from 'express';

type AsyncRequestHandler = (req: Request, res: Response, next: NextFunction) => Promise<void>;

// Express 4, async route handler'larda reject olan promise'leri otomatik
// yakalamaz (Express 5'te bu native olarak çözüldü). Bu sarmalayıcı, reject'i
// merkezi error middleware'ine (`next`) yönlendirir.
export function asyncHandler(handler: AsyncRequestHandler) {
  return (req: Request, res: Response, next: NextFunction): void => {
    handler(req, res, next).catch(next);
  };
}
