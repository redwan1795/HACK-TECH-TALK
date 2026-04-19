import express from 'express';
import cors from 'cors';
import path from 'path';
import { env } from './config/env';
import { pool } from './db/pool';
import { apiRouter } from './api/routes';
import { errorHandler, notFoundHandler } from './api/middlewares/errorHandler';

export function buildApp() {
  const app = express();

  app.use(cors({ origin: env.CORS_ORIGIN }));
  app.use(express.json());

  // Serve uploaded images at /uploads/<filename>
  const uploadsDir = path.resolve(process.cwd(), env.UPLOAD_DIR);
  app.use('/uploads', express.static(uploadsDir));

  // /food — sanity probe (API alive + DB reachable)
  app.get('/food', async (_req, res) => {
    try {
      const { rows } = await pool.query(
        'SELECT current_database() AS db, current_user AS "user", version()'
      );
      res.json({
        service: 'community-garden-api',
        status: 'ok',
        database: rows[0].db,
        dbUser: rows[0].user,
        postgres: rows[0].version,
      });
    } catch (err: any) {
      res.status(500).json({
        service: 'community-garden-api',
        status: 'error',
        error: err.message,
      });
    }
  });

  app.use('/api/v1', apiRouter);
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
