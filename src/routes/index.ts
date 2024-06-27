import { Router } from 'express';
import { useLogger } from '../shared';
import chatRoutes from './chats';
import contactRoutes from './contacts';
import groupRoutes from './groups';
import messageRoutes from './messages';
import sessionRoutes from './sessions';

const router = Router();

router.use('/sessions', sessionRoutes);
router.use('/:sessionId/chats', chatRoutes);
router.use('/:sessionId/contacts', contactRoutes);
router.use('/:sessionId/groups', groupRoutes);
router.use('/:sessionId/messages', messageRoutes);

function errorHandler(err, req, res, next) {
    useLogger().error('Catch-All error handler', err);

    res.status(err.status || 500).send(err.message);
}

router.use(errorHandler);

export default router;
