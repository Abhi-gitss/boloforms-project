// backend/index.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const { signPdfController } = require('./controllers/pdfController'); // keep your controller

const app = express();
const PORT = process.env.PORT || 5000;

// FRONTEND_URL should be the exact origin your front-end is served from, e.g.
// https://boloforms-project.vercel.app
const FRONTEND_URL = process.env.FRONTEND_URL || '*';

app.use(cors({
  origin: FRONTEND_URL,
}));
app.use(express.json({ limit: '50mb' }));

// Mongo connection string from env
const MONGO_URI = process.env.MONGO_URI;
if (!MONGO_URI) {
  console.error(' ERROR: MONGO_URI not set in environment. Exiting.');
  process.exit(1);
}

mongoose.connect(MONGO_URI)
  .then(() => console.log('✅ MongoDB connected successfully'))
  .catch(err => {
    console.error(' Failed to connect to MongoDB:', err);
    process.exit(1);
  });

// Routes
app.post('/sign-pdf', signPdfController);

// Health check
app.get('/health', (req, res) => res.json({ ok: true, time: Date.now() }));

app.listen(PORT, () => {
  console.log(`🚀 Backend listening on port ${PORT}`);
});
