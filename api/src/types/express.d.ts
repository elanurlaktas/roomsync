export interface AuthenticatedUser {
  id: string;
  role: 'member' | 'admin';
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

export {};
