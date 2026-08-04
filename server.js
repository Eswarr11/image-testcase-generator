const express = require('express');
const { createApp } = require('./backend/dist/app');

// Reference express so the import is retained (Vercel entry detection).
const app = createApp();
app.set('trust proxy', 1);
void express;

module.exports = app;
