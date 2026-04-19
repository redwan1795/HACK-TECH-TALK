import { Router } from 'express';
import * as NotificationService from '../../services/notificationService';
import { authenticate } from '../middlewares/authenticate';

export const notificationsRouter = Router();

// GET /api/v1/notifications?unread=true
notificationsRouter.get('/', authenticate, (req, res) => {
  const unreadOnly = req.query.unread === 'true';
  const items = NotificationService.listForUser(req.user!.id, { unreadOnly });
  res.json({
    notifications: items,
    unreadCount: NotificationService.unreadCount(req.user!.id),
  });
});

notificationsRouter.post('/:id/read', authenticate, (req, res) => {
  const ok = NotificationService.markRead(req.user!.id, req.params.id);
  res.json({ ok });
});

notificationsRouter.post('/read-all', authenticate, (req, res) => {
  const count = NotificationService.markAllRead(req.user!.id);
  res.json({ ok: true, count });
});
