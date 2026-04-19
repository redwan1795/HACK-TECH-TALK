import { Request, Response, NextFunction } from 'express';
import { UserRole } from '../../utils/jwt';
import { HttpError } from './errorHandler';

export function authorize(...allowedRoles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new HttpError(401, 'NO_TOKEN', 'Authentication required'));
    }

    if (!allowedRoles.includes(req.user.role)) {
      return next(
        new HttpError(403, 'FORBIDDEN', `Requires one of: ${allowedRoles.join(', ')}`)
      );
    }

    next();
  };
}

// Convenience: any producer role
export const authorizeProducer = authorize('producer_home', 'producer_farmer');
