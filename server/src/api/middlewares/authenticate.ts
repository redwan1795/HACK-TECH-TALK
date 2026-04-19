import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../../utils/jwt';
import { HttpError } from './errorHandler';

export function authenticate(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;

  if (!header || !header.startsWith('Bearer ')) {
    return next(new HttpError(401, 'NO_TOKEN', 'Authentication required'));
  }

  const token = header.slice(7).trim();

  try {
    const payload = verifyAccessToken(token);
    req.user = { id: payload.sub, email: payload.email, role: payload.role };
    next();
  } catch {
    next(new HttpError(401, 'INVALID_TOKEN', 'Token invalid or expired'));
  }
}

// Optional: attaches req.user if token is valid, otherwise continues anonymously.
export function authenticateOptional(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) return next();

  try {
    const payload = verifyAccessToken(header.slice(7).trim());
    req.user = { id: payload.sub, email: payload.email, role: payload.role };
  } catch {
    // Ignore bad tokens on optional routes
  }
  next();
}
