import { Router, Request, Response, NextFunction } from 'express';
import { body, query as qv, param, validationResult } from 'express-validator';
import { query } from '../db/client';
import { authenticate } from '../middleware/authenticate';
import { upload } from '../middleware/upload';
import { searchListings } from '../services/listingService';
import { getCoordinatesForZip } from '../services/geocodeService';
import { triggerListingPublishFanout } from '../jobs/listingPublishFanout';

const router = Router();

// ── GET /listings — public search + browse ────────────────────────────────────
router.get(
  '/',
  qv('q').optional().isString().trim(),
  qv('zip').optional().isPostalCode('US'),
  qv('radius_miles').optional().isFloat({ min: 1, max: 500 }).toFloat(),
  qv('category').optional().isIn(['vegetable', 'fruit', 'flower', 'egg', 'other']),
  qv('page').optional().isInt({ min: 1 }).toInt(),
  qv('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(422).json({ error: { code: 'VALIDATION_ERROR', details: errors.array() } });
      return;
    }
    try {
      const result = await searchListings({
        q: req.query.q as string | undefined,
        zip: req.query.zip as string | undefined,
        radius_miles: req.query.radius_miles as unknown as number | undefined,
        category: req.query.category as string | undefined,
        page: req.query.page as unknown as number | undefined,
        limit: req.query.limit as unknown as number | undefined,
      });
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
);

// ── GET /listings/:id — public single listing ─────────────────────────────────
router.get(
  '/:id',
  param('id').isUUID(),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(422).json({ error: { code: 'VALIDATION_ERROR', details: errors.array() } });
      return;
    }
    try {
      const { rows } = await query(
        `SELECT l.*, u.name AS producer_name
         FROM listings l
         JOIN users u ON u.id = l.producer_id
         WHERE l.id = $1`,
        [req.params.id]
      );
      if (rows.length === 0) {
        res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Listing not found' } });
        return;
      }
      res.json(rows[0]);
    } catch (err) {
      next(err);
    }
  }
);

// ── POST /listings — create (any authenticated user) ─────────────────────────
router.post(
  '/',
  authenticate,
  upload.array('images', 5),
  body('title').notEmpty().trim().isLength({ max: 200 }),
  body('description').optional().trim(),
  body('category').isIn(['vegetable', 'fruit', 'flower', 'egg', 'other']),
  body('price_cents').optional().isInt({ min: 0 }),
  body('quantity_available').isInt({ min: 0 }),
  body('location_zip').isPostalCode('US'),
  body('exchange_for').optional().trim(),
  body('ready_to_deliver').optional().isBoolean(),
  body('pickup_date').optional().isISO8601().withMessage('pickup_date must be YYYY-MM-DD'),
  body('pickup_time').optional().matches(/^\d{2}:\d{2}$/).withMessage('pickup_time must be HH:MM'),
  body('pickup_location').optional().trim().isLength({ max: 300 }),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(422).json({ error: { code: 'VALIDATION_ERROR', details: errors.array() } });
      return;
    }
    try {
      const {
        title, description, category, price_cents,
        quantity_available, location_zip, exchange_for,
        pickup_date, pickup_time, pickup_location,
      } = req.body as {
        title: string; description?: string; category: string; price_cents?: string;
        quantity_available: string; location_zip: string; exchange_for?: string;
        ready_to_deliver?: string; pickup_date?: string; pickup_time?: string; pickup_location?: string;
      };

      const readyToDeliver = req.body.ready_to_deliver !== 'false' && req.body.ready_to_deliver !== false;

      if (!readyToDeliver && (!pickup_date || !pickup_time || !pickup_location)) {
        res.status(422).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'pickup_date, pickup_time, and pickup_location are required when ready_to_deliver is false',
          },
        });
        return;
      }

      const files = (req.files as Express.Multer.File[]) ?? [];
      const imageUrls = files.map((f) => `/uploads/${f.filename}`);

      const coords = await getCoordinatesForZip(location_zip);

      const { rows } = await query(
        `INSERT INTO listings
           (producer_id, title, description, category, price_cents,
            quantity_available, location_zip, location_lat, location_lng,
            images, exchange_for, ready_to_deliver, pickup_date, pickup_time, pickup_location)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
         RETURNING *`,
        [
          req.user!.sub,
          title,
          description ?? null,
          category,
          price_cents ? parseInt(price_cents) : null,
          parseInt(quantity_available),
          location_zip,
          coords?.lat ?? null,
          coords?.lng ?? null,
          imageUrls,
          exchange_for ?? null,
          readyToDeliver,
          readyToDeliver ? null : pickup_date,
          readyToDeliver ? null : pickup_time,
          readyToDeliver ? null : pickup_location,
        ]
      );
      res.status(201).json(rows[0]);
    } catch (err) {
      next(err);
    }
  }
);

// ── PUT /listings/:id — update (owner or admin) ───────────────────────────────
router.put(
  '/:id',
  authenticate,
  upload.array('images', 5),
  param('id').isUUID(),
  body('title').optional().notEmpty().trim().isLength({ max: 200 }),
  body('description').optional().trim(),
  body('category').optional().isIn(['vegetable', 'fruit', 'flower', 'egg', 'other']),
  body('price_cents').optional().isInt({ min: 0 }),
  body('quantity_available').optional().isInt({ min: 0 }),
  body('location_zip').optional().isPostalCode('US'),
  body('exchange_for').optional().trim(),
  body('ready_to_deliver').optional().isBoolean(),
  body('pickup_date').optional().isISO8601().withMessage('pickup_date must be YYYY-MM-DD'),
  body('pickup_time').optional().matches(/^\d{2}:\d{2}$/).withMessage('pickup_time must be HH:MM'),
  body('pickup_location').optional().trim().isLength({ max: 300 }),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(422).json({ error: { code: 'VALIDATION_ERROR', details: errors.array() } });
      return;
    }
    try {
      const { rows: existing } = await query(
        'SELECT producer_id, ready_to_deliver FROM listings WHERE id = $1',
        [req.params.id]
      );
      if (existing.length === 0) {
        res.status(404).json({ error: { code: 'NOT_FOUND' } });
        return;
      }
      if (existing[0].producer_id !== req.user!.sub && req.user!.role !== 'admin') {
        res.status(403).json({ error: { code: 'FORBIDDEN', message: 'You do not own this listing' } });
        return;
      }

      const {
        title, description, category, price_cents,
        quantity_available, location_zip, exchange_for,
        pickup_date, pickup_time, pickup_location,
      } = req.body as Record<string, string | undefined>;
      const files = (req.files as Express.Multer.File[]) ?? [];

      const hasReadyToDeliver = req.body.ready_to_deliver !== undefined;
      const newReadyToDeliver = hasReadyToDeliver
        ? req.body.ready_to_deliver !== 'false' && req.body.ready_to_deliver !== false
        : existing[0].ready_to_deliver;

      if (!newReadyToDeliver && (!pickup_date || !pickup_time || !pickup_location)) {
        res.status(422).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'pickup_date, pickup_time, and pickup_location are required when ready_to_deliver is false',
          },
        });
        return;
      }

      let newCoords: { lat: number | null; lng: number | null } | undefined;
      if (location_zip) {
        const c = await getCoordinatesForZip(location_zip);
        newCoords = { lat: c?.lat ?? null, lng: c?.lng ?? null };
      }

      const imageUrls = files.length > 0 ? files.map((f) => `/uploads/${f.filename}`) : undefined;

      const { rows } = await query(
        `UPDATE listings SET
           title              = COALESCE($1, title),
           description        = COALESCE($2, description),
           category           = COALESCE($3::listing_category, category),
           price_cents        = COALESCE($4, price_cents),
           quantity_available = COALESCE($5, quantity_available),
           location_zip       = COALESCE($6, location_zip),
           location_lat       = COALESCE($7, location_lat),
           location_lng       = COALESCE($8, location_lng),
           images             = COALESCE($9, images),
           exchange_for       = COALESCE($10, exchange_for),
           ready_to_deliver   = COALESCE($11, ready_to_deliver),
           pickup_date        = COALESCE($12, pickup_date),
           pickup_time        = COALESCE($13, pickup_time),
           pickup_location    = COALESCE($14, pickup_location),
           updated_at         = NOW()
         WHERE id = $15
         RETURNING *`,
        [
          title ?? null,
          description ?? null,
          category ?? null,
          price_cents ? parseInt(price_cents) : null,
          quantity_available ? parseInt(quantity_available) : null,
          location_zip ?? null,
          newCoords?.lat ?? null,
          newCoords?.lng ?? null,
          imageUrls ?? null,
          exchange_for ?? null,
          hasReadyToDeliver ? newReadyToDeliver : null,
          newReadyToDeliver ? null : (pickup_date ?? null),
          newReadyToDeliver ? null : (pickup_time ?? null),
          newReadyToDeliver ? null : (pickup_location ?? null),
          req.params.id,
        ]
      );
      res.json(rows[0]);
    } catch (err) {
      next(err);
    }
  }
);

// ── DELETE /listings/:id — soft delete (owner or admin) ───────────────────────
router.delete(
  '/:id',
  authenticate,
  param('id').isUUID(),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { rows } = await query(
        'SELECT producer_id FROM listings WHERE id = $1',
        [req.params.id]
      );
      if (rows.length === 0) {
        res.status(404).json({ error: { code: 'NOT_FOUND' } });
        return;
      }
      if (rows[0].producer_id !== req.user!.sub && req.user!.role !== 'admin') {
        res.status(403).json({ error: { code: 'FORBIDDEN' } });
        return;
      }
      await query(
        'UPDATE listings SET is_available = FALSE, updated_at = NOW() WHERE id = $1',
        [req.params.id]
      );
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  }
);

// ── PATCH /listings/:id/publish — toggle publish state ────────────────────────
router.patch(
  '/:id/publish',
  authenticate,
  param('id').isUUID(),
  body('publish').isBoolean(),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(422).json({ error: { code: 'VALIDATION_ERROR', details: errors.array() } });
      return;
    }
    try {
      const { rows } = await query(
        'SELECT producer_id, quantity_available FROM listings WHERE id = $1',
        [req.params.id]
      );
      if (rows.length === 0) {
        res.status(404).json({ error: { code: 'NOT_FOUND' } });
        return;
      }
      if (rows[0].producer_id !== req.user!.sub && req.user!.role !== 'admin') {
        res.status(403).json({ error: { code: 'FORBIDDEN' } });
        return;
      }
      const publish = req.body.publish as boolean;
      if (publish && rows[0].quantity_available === 0) {
        res.status(422).json({
          error: { code: 'CANNOT_PUBLISH', message: 'Cannot publish a listing with 0 quantity' },
        });
        return;
      }
      const { rows: updated } = await query(
        'UPDATE listings SET is_available = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
        [publish, req.params.id]
      );

      if (publish) {
        triggerListingPublishFanout(req.params.id);
      }

      res.json(updated[0]);
    } catch (err) {
      next(err);
    }
  }
);

export default router;
