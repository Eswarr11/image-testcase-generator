/**
 * Vercel Express entrypoint (must be named server/app/index at repo root or src/).
 * Built backend is required so local `npm start` path stays unchanged.
 */
const { createApp } = require('./backend/dist/app');

module.exports = createApp();
