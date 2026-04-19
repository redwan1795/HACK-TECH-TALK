import { Router } from 'express';
import { z } from 'zod';
import * as FutureOrderService from '../../services/futureOrderService';
import { authenticate } from '../middlewares/authenticate';
import { authorize } from '../middlewares/authorize';
import { HttpError } from '../middlewares/errorHandler';

export const futureOrdersRouter = Router();

const CreateSchema = z.object({
  productQuery: z.string().min(2).max(200),
  category: z.enum(['fruit','vegetable','herb','flower','egg','dairy','other']).optional(),
  quantityNeeded: z.coerce.number().int().min(1).max(1000).default(1),
  proximityMiles: z.coerce.number().int().min(1).max(500).default(25),
  daysUntilExpiry: z.coerce.number().int().min(1).max(30).default(7),
  locationZip: z.string().regex(/^\d{5}$/).optional(),
});

futureOrdersRouter.post('/', authenticate, authorize('consumer', 'broker'), async (req, res, next) => {
  try {
    const parsed = CreateSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new HttpError(400, 'VALIDATION_ERROR', parsed.error.issues[0].message);
    }
    const fo = await FutureOrderService.createFutureOrder(req.user!.id, parsed.data);
    res.status(201).json({ futureOrder: fo });
  } catch (err) { next(err); }
});

futureOrdersRouter.get('/', authenticate, async (req, res, next) => {
  try {
    const rows = await FutureOrderService.listMyFutureOrders(req.user!.id);
    res.json({ futureOrders: rows });
  } catch (err) { next(err); }
});

futureOrdersRouter.delete('/:id', authenticate, async (req, res, next) => {
  try {
    await FutureOrderService.cancelFutureOrder(req.user!.id, req.params.id);
    res.json({ ok: true });
  } catch (err) { next(err); }
});
