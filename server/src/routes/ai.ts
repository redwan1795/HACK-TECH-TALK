import { Router, Request, Response, NextFunction } from 'express';
import { body, validationResult } from 'express-validator';
import { authenticate } from '../middleware/authenticate';
import { aiRateLimiter } from '../middleware/rateLimiter';
import { aiSearch } from '../services/aiSearchService';

const router = Router();

router.post(
  '/search',
  authenticate,
  aiRateLimiter,
  body('query').trim().isLength({ min: 2, max: 500 }).withMessage('query must be 2–500 characters'),
  body('user_zip').optional().matches(/^\d{5}$/).withMessage('user_zip must be a 5-digit ZIP'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(422).json({ error: { code: 'VALIDATION_ERROR', details: errors.array() } });
      return;
    }
    try {
      const result = await aiSearch({
        query: req.body.query as string,
        userZip: req.body.user_zip as string | undefined,
      });
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
);

// M4 stub
router.post('/parse-demand', (_req, res) => {
  res.status(501).json({ error: { code: 'NOT_IMPLEMENTED', message: 'Coming in M4' } });
});

export default router;
