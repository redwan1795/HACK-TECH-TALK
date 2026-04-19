import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken, TokenPayload } from '../services/tokenService';

declare global {
  namespace Express {
    interface Request {
      user?: TokenPayload;
    }
  }
}

export function authenticate(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({
      error: { code: 'UNAUTHORIZED', message: 'Missing or malformed Authorization header' },
    });
    return;
  }
  const token = header.slice(7);
  try {
    req.user = verifyAccessToken(token);
    next();
  } catch {
    res.status(401).json({
      error: { code: 'INVALID_TOKEN', message: 'Token is invalid or expired' },
    });
  }
}
