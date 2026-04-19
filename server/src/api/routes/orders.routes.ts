import { Router } from 'express';
import { z } from 'zod';
import * as OrderService from '../../services/orderService';
import { authenticate } from '../middlewares/authenticate';
import { authorize } from '../middlewares/authorize';
import { HttpError } from '../middlewares/errorHandler';

export const ordersRouter = Router();

const ItemSchema = z.object({
  listingId: z.string().uuid(),
  quantity: z.number().int().min(1),
});

const CreateSchema = z.object({
  items: z.array(ItemSchema).min(1),
});

// POST /api/v1/orders — create pending order (consumer + broker)
ordersRouter.post(
  '/',
  authenticate,
  authorize('consumer', 'broker'),
  async (req, res, next) => {
    try {
      const parsed = CreateSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new HttpError(400, 'VALIDATION_ERROR', parsed.error.issues[0].message);
      }
      const order = await OrderService.createOrder(req.user!.id, parsed.data.items);
      res.status(201).json({ order });
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/v1/orders/:id/confirm — fake Stripe confirm
ordersRouter.post(
  '/:id/confirm',
  authenticate,
  authorize('consumer', 'broker'),
  async (req, res, next) => {
    try {
      const order = await OrderService.confirmOrder(req.params.id, req.user!.id);
      res.json({ order });
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/v1/orders/fee-preview — compute fee without creating (for cart)
ordersRouter.post(
  '/fee-preview',
  authenticate,
  authorize('consumer', 'broker'),
  async (req, res, next) => {
    try {
      const parsed = CreateSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new HttpError(400, 'VALIDATION_ERROR', parsed.error.issues[0].message);
      }
      const fee = await OrderService.feePreview(parsed.data.items);
      res.json(fee);
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/v1/orders — list my orders
ordersRouter.get('/', authenticate, async (req, res, next) => {
  try {
    const orders = await OrderService.listMyOrders(req.user!.id);
    res.json({ orders });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/orders/:id — my order detail
ordersRouter.get('/:id', authenticate, async (req, res, next) => {
  try {
    const order = await OrderService.getOrder(req.params.id, req.user!.id);
    res.json({ order });
  } catch (err) {
    next(err);
  }
});
