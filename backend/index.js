// index.js
require('dotenv').config({ path: './url.env' });

const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const { signPdfController } = require('./controllers/pdfController');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
const FRONTEND_URL = process.env.FRONTEND_URL || 'https://boloforms-project.vercel.app/';
app.use(cors({ origin: FRONTEND_URL }));
app.use(express.json({ limit: '50mb' }));

// Mongo connection string must be in env var for safety.
// Example (locally): export MONGO_URI="mongodb://localhost:27017/bolo"
const MONGO_URI = process.env.MONGO_URI;
if (!MONGO_URI) {
  console.error('ERROR: MONGO_URI environment variable not set.');
  process.exit(1);
}

(async () => {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('Connected to MongoDB.');
  } catch (err) {
    console.error('Failed to connect to MongoDB:', err);
    process.exit(1);
  }

  // Routes
  app.post('/sign-pdf', signPdfController);

  // basic health check
  app.get('/health', (req, res) => res.json({ ok: true, ts: Date.now() }));

  app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT} (PORT=${PORT})`);
  });
})();
