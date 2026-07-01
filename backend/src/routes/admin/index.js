const express = require('express');
const { requireAuth, requireSuperAdmin } = require('../../middleware/auth');

const authRouter = require('./auth');
const workspacesRouter = require('./workspaces');
const usersRouter = require('./users');
const statsRouter = require('./stats');
const subscriptionsRouter = require('./subscriptions');
const analyticsRouter = require('./analytics');

const router = express.Router();

// Public admin auth route (login)
router.use('/auth', authRouter);

// Protected admin routes - require superadmin role
router.use(requireAuth);
router.use(requireSuperAdmin);

router.use('/workspaces', workspacesRouter);
router.use('/users', usersRouter);
router.use('/stats', statsRouter);
router.use('/subscriptions', subscriptionsRouter);
router.use('/analytics', analyticsRouter);

module.exports = router;
