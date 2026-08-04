/**
 * Vercel serverless API entry — only /api/* traffic should hit this function.
 * Static UI is served from `outputDirectory` (public/), not by Express.
 */
const { createApp } = require('../backend/dist/app');

const app = createApp();
app.set('trust proxy', 1);

module.exports = app;
