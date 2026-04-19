import { Router } from 'express';
import { query } from '../db/client';
import { authenticate } from '../middleware/authenticate';

const router = Router();

router.get('/me', authenticate, async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT id, email, name, role,
              location_zip AS "locationZip",
              location_lat AS "locationLat",
              location_lng AS "locationLng",
              licensed,
              created_at   AS "createdAt"
       FROM users WHERE id = $1`,
      [req.user!.sub]
    );
    if (rows.length === 0) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'User not found' } });
      return;
    }
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});

router.patch('/me', authenticate, async (req, res, next) => {
  const { name, locationZip } = req.body as { name?: string; locationZip?: string };
  try {
    const { rows } = await query(
      `UPDATE users
       SET name         = COALESCE($1, name),
           location_zip = COALESCE($2, location_zip)
       WHERE id = $3
       RETURNING id, email, name, role,
                 location_zip AS "locationZip",
                 licensed,
                 created_at   AS "createdAt"`,
      [name ?? null, locationZip ?? null, req.user!.sub]
    );
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});

export default router;
