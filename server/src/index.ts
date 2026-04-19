import 'dotenv/config';
import path from 'path';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import listingsRouter from './routes/listings';
import authRouter from './routes/auth';
import usersRouter from './routes/users';
import ordersRouter from './routes/orders';
import aiRouter from './routes/ai';
import adminRouter from './routes/admin';
import futureOrdersRouter from './routes/future-orders';
import subscriptionsRouter from './routes/subscriptions';
import { errorHandler } from './middleware/errorHandler';

export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(cors({ origin: process.env.CORS_ORIGIN ?? 'http://localhost:5173' }));
  app.use(express.json());
  app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  app.use('/api/v1/auth',          authRouter);
  app.use('/api/v1/users',         usersRouter);
  app.use('/api/v1/listings',      listingsRouter);
  app.use('/api/v1/orders',        ordersRouter);
  app.use('/api/v1/ai',            aiRouter);
  app.use('/api/v1/admin',         adminRouter);

  const stub = (_req: express.Request, res: express.Response): void => {
    res.status(501).json({ error: { code: 'NOT_IMPLEMENTED', message: 'Coming in a future milestone' } });
  };

  app.use('/api/v1/subscriptions',  subscriptionsRouter);
  app.use('/api/v1/exchanges',      stub);
  app.use('/api/v1/future-orders',  futureOrdersRouter);

  app.use(errorHandler);

  return app;
}

// Only start listening when run directly (not in tests)
if (require.main === module) {
  const port = parseInt(process.env.PORT ?? '3000');
  createApp().listen(port, () =>
    console.log(`Server listening on http://localhost:${port}`)
  );
}
