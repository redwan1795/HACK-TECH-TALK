import { Request, Response, NextFunction } from 'express';
import type { UserRole } from '@community-garden/types';

export function authorize(...roles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
      });
      return;
    }
    if (!roles.includes(req.user.role)) {
      res.status(403).json({
        error: { code: 'FORBIDDEN', message: `Requires one of: ${roles.join(', ')}` },
      });
      return;
    }
    next();
  };
}
