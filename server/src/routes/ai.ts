import { Router, Request, Response, NextFunction } from 'express';
import { body, validationResult } from 'express-validator';
import { authenticate } from '../middleware/authenticate';
import { authorize } from '../middleware/authorize';
import { aiRateLimiter } from '../middleware/rateLimiter';
import { aiSearch } from '../services/aiSearchService';
import { parseDemandIntent, DemandParseError } from '../services/demandParseService';

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

// ── POST /ai/parse-demand — parse demand intent (preview only, does not save) ─
router.post(
  '/parse-demand',
  authenticate,
  body('query').trim().notEmpty().isLength({ max: 1000 }).withMessage('query must be 1–1000 characters'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ error: { code: 'VALIDATION_ERROR', details: errors.array() } });
      return;
    }
    try {
      const intent = await parseDemandIntent(req.body.query as string);
      res.json(intent);
    } catch (err) {
      if (err instanceof DemandParseError) {
        res.status(422).json({ error: { code: 'PARSE_FAILED', message: err.message } });
        return;
      }
      next(err);
    }
  }
);

export default router;
