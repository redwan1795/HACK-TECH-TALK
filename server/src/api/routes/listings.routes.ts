import { Router } from 'express';
import path from 'path';
import fs from 'fs';
import multer from 'multer';
import { z } from 'zod';
import { pool } from '../../db/pool';
import { authenticate } from '../middlewares/authenticate';
import { authorizeProducer } from '../middlewares/authorize';
import { HttpError } from '../middlewares/errorHandler';
import { env } from '../../config/env';
import { lookupZip } from '../../services/geocodeService';
import { searchListings } from '../../services/listingService';
import { runMatchingForListing } from '../../services/futureOrderService';

export const listingsRouter = Router();

const UPLOAD_ROOT = path.resolve(process.cwd(), env.UPLOAD_DIR);
fs.mkdirSync(UPLOAD_ROOT, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_ROOT),
  filename: (_req, file, cb) => {
    const safe = file.originalname.toLowerCase().replace(/[^a-z0-9.]+/g, '_');
    cb(null, `${Date.now()}_${Math.round(Math.random() * 1e6)}_${safe}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: env.MAX_UPLOAD_BYTES, files: 5 },
  fileFilter: (_req, file, cb) => {
    if (!/^image\//.test(file.mimetype)) {
      return cb(new HttpError(400, 'BAD_FILE', 'Only image uploads allowed'));
    }
    cb(null, true);
  },
});

function mapRow(r: any) {
  return {
    id: r.id,
    title: r.title,
    description: r.description,
    category: r.category,
    priceCents: r.price_cents,
    unit: r.unit,
    quantityAvailable: r.quantity_available,
    exchangeFor: r.exchange_for,
    locationZip: r.location_zip,
    locationLat: r.location_lat !== null ? Number(r.location_lat) : null,
    locationLng: r.location_lng !== null ? Number(r.location_lng) : null,
    images: r.images,
    isAvailable: r.is_available,
    createdAt: r.created_at,
    producer: {
      id: r.producer_id,
      name: r.producer_name,
      licensed: r.producer_licensed,
    },
  };
}

// fire-and-forget matching (don't make the HTTP response wait)
function triggerMatchingAsync(listingId: string) {
  setImmediate(async () => {
    try {
      const count = await runMatchingForListing(listingId);
      if (count > 0) {
        console.log(`🎯 Matching ran for listing ${listingId.slice(0, 8)} — ${count} consumers notified`);
      }
    } catch (err) {
      console.error('Matching error:', err);
    }
  });
}

// ---- GET /listings ----
const SearchQuerySchema = z.object({
  q: z.string().optional(),
  zip: z.string().regex(/^\d{5}$/).optional(),
  radius_miles: z.coerce.number().int().min(1).max(500).default(25),
  category: z.enum(['fruit','vegetable','herb','flower','egg','dairy','other']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  sort: z.enum(['distance','newest','price_asc','price_desc']).optional(),
});

listingsRouter.get('/', async (req, res, next) => {
  try {
    const parsed = SearchQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      throw new HttpError(400, 'VALIDATION_ERROR', parsed.error.issues[0].message);
    }
    const p = parsed.data;
    const result = await searchListings({
      q: p.q, zip: p.zip, radiusMiles: p.radius_miles,
      category: p.category, page: p.page, limit: p.limit,
      sort: p.sort ?? (p.zip ? 'distance' : 'newest'),
    });
    res.json({
      listings: result.listings,
      total: result.total,
      page: p.page,
      limit: p.limit,
      anchor: result.anchor,
    });
  } catch (err) { next(err); }
});

listingsRouter.get('/mine', authenticate, authorizeProducer, async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT l.*, u.id AS producer_id, u.display_name AS producer_name, u.licensed AS producer_licensed
       FROM listings l JOIN users u ON u.id = l.producer_id
       WHERE l.producer_id = $1 ORDER BY l.created_at DESC`,
      [req.user!.id]
    );
    res.json({ listings: rows.map(mapRow) });
  } catch (err) { next(err); }
});

listingsRouter.get('/:id', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT l.*, u.id AS producer_id, u.display_name AS producer_name, u.licensed AS producer_licensed
       FROM listings l JOIN users u ON u.id = l.producer_id
       WHERE l.id = $1 LIMIT 1`,
      [req.params.id]
    );
    if (rows.length === 0) throw new HttpError(404, 'NOT_FOUND', 'Listing not found');
    res.json({ listing: mapRow(rows[0]) });
  } catch (err) { next(err); }
});

const CreateSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  category: z.enum(['fruit','vegetable','herb','flower','egg','dairy','other']),
  priceCents: z.coerce.number().int().min(0).optional(),
  unit: z.string().min(1).max(20).default('lb'),
  quantityAvailable: z.coerce.number().int().min(0),
  exchangeFor: z.string().max(200).optional(),
  locationZip: z.string().regex(/^\d{5}$/),
});

listingsRouter.post(
  '/', authenticate, authorizeProducer, upload.array('images', 5),
  async (req, res, next) => {
    try {
      const parsed = CreateSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new HttpError(400, 'VALIDATION_ERROR', parsed.error.issues[0].message);
      }
      const d = parsed.data;
      const geo = await lookupZip(d.locationZip);
      const files = (req.files as Express.Multer.File[] | undefined) ?? [];
      const imageUrls = files.map((f) => `/uploads/${f.filename}`);

      const { rows } = await pool.query(
        `INSERT INTO listings
          (producer_id, title, description, category, price_cents, unit,
           quantity_available, exchange_for, location_zip, location_lat, location_lng, images)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
         RETURNING *`,
        [
          req.user!.id, d.title, d.description ?? null, d.category,
          d.priceCents ?? null, d.unit, d.quantityAvailable, d.exchangeFor ?? null,
          d.locationZip, geo?.lat ?? null, geo?.lng ?? null, imageUrls,
        ]
      );

      const { rows: joined } = await pool.query(
        `SELECT l.*, u.id AS producer_id, u.display_name AS producer_name, u.licensed AS producer_licensed
         FROM listings l JOIN users u ON u.id = l.producer_id WHERE l.id = $1`,
        [rows[0].id]
      );

      // 🔥 Trigger future-order matching
      triggerMatchingAsync(rows[0].id);

      res.status(201).json({ listing: mapRow(joined[0]) });
    } catch (err) { next(err); }
  }
);

const UpdateSchema = CreateSchema.partial();

listingsRouter.patch('/:id', authenticate, authorizeProducer, async (req, res, next) => {
  try {
    const { rows: existing } = await pool.query(
      `SELECT producer_id FROM listings WHERE id = $1`, [req.params.id]
    );
    if (existing.length === 0) throw new HttpError(404, 'NOT_FOUND', 'Listing not found');
    if (existing[0].producer_id !== req.user!.id) {
      throw new HttpError(403, 'FORBIDDEN', 'Not your listing');
    }

    const parsed = UpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new HttpError(400, 'VALIDATION_ERROR', parsed.error.issues[0].message);
    }
    const d = parsed.data;
    const sets: string[] = [];
    const values: any[] = [];
    const mapping: Record<string, string> = {
      title: 'title', description: 'description', category: 'category',
      priceCents: 'price_cents', unit: 'unit',
      quantityAvailable: 'quantity_available', exchangeFor: 'exchange_for',
      locationZip: 'location_zip',
    };
    for (const [k, col] of Object.entries(mapping)) {
      if ((d as any)[k] !== undefined) {
        values.push((d as any)[k]);
        sets.push(`${col} = $${values.length}`);
      }
    }
    if (d.locationZip) {
      const geo = await lookupZip(d.locationZip);
      if (geo) {
        values.push(geo.lat);
        sets.push(`location_lat = $${values.length}`);
        values.push(geo.lng);
        sets.push(`location_lng = $${values.length}`);
      }
    }
    if (sets.length === 0) throw new HttpError(400, 'NO_FIELDS', 'No fields provided');

    values.push(req.params.id);
    const { rows } = await pool.query(
      `UPDATE listings SET ${sets.join(', ')} WHERE id = $${values.length} RETURNING id`,
      values
    );
    const { rows: joined } = await pool.query(
      `SELECT l.*, u.id AS producer_id, u.display_name AS producer_name, u.licensed AS producer_licensed
       FROM listings l JOIN users u ON u.id = l.producer_id WHERE l.id = $1`,
      [rows[0].id]
    );
    res.json({ listing: mapRow(joined[0]) });
  } catch (err) { next(err); }
});

listingsRouter.patch('/:id/publish', authenticate, authorizeProducer, async (req, res, next) => {
  try {
    const { rows: existing } = await pool.query(
      `SELECT producer_id, is_available FROM listings WHERE id = $1`, [req.params.id]
    );
    if (existing.length === 0) throw new HttpError(404, 'NOT_FOUND', 'Listing not found');
    if (existing[0].producer_id !== req.user!.id) {
      throw new HttpError(403, 'FORBIDDEN', 'Not your listing');
    }
    const newValue = !existing[0].is_available;
    await pool.query(`UPDATE listings SET is_available = $1 WHERE id = $2`, [newValue, req.params.id]);

    // Only run matching when going UNPUBLISHED → PUBLISHED
    if (newValue === true) {
      triggerMatchingAsync(req.params.id);
    }

    res.json({ id: req.params.id, isAvailable: newValue });
  } catch (err) { next(err); }
});

listingsRouter.delete('/:id', authenticate, authorizeProducer, async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT producer_id FROM listings WHERE id = $1`, [req.params.id]
    );
    if (rows.length === 0) throw new HttpError(404, 'NOT_FOUND', 'Listing not found');
    if (rows[0].producer_id !== req.user!.id) {
      throw new HttpError(403, 'FORBIDDEN', 'Not your listing');
    }
    await pool.query(`UPDATE listings SET is_available = FALSE WHERE id = $1`, [req.params.id]);
    res.json({ ok: true });
  } catch (err) { next(err); }
});
