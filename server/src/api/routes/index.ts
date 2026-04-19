import { Router } from 'express';
import { listingsRouter } from './listings.routes';
import { authRouter } from './auth.routes';
import { ordersRouter } from './orders.routes';
import { futureOrdersRouter } from './futureOrders.routes';
import { notificationsRouter } from './notifications.routes';
import { adminRouter } from './admin.routes';
import { brokerRouter } from './broker.routes';
import { exchangesRouter } from './exchanges.routes';

export const apiRouter = Router();

apiRouter.use('/auth', authRouter);
apiRouter.use('/listings', listingsRouter);
apiRouter.use('/orders', ordersRouter);
apiRouter.use('/future-orders', futureOrdersRouter);
apiRouter.use('/notifications', notificationsRouter);
apiRouter.use('/admin', adminRouter);
apiRouter.use('/broker', brokerRouter);
apiRouter.use('/exchanges', exchangesRouter);
