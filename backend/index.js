const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
// Make sure this path is correct. If your file is named 'pdfController.js', keep it like this:
const { signPdfController } = require('./controllers/pdfController'); 

const app = express();
const PORT = 5000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// --- MONGODB CONNECTION ---
// TODO: PASTE YOUR MONGODB CONNECTION STRING BELOW (Keep the quotes "")
const MONGO_URI = "mongodb+srv://boloproject:boloproject@cluster0.gjjerkp.mongodb.net/?appName=Cluster0";

mongoose.connect(MONGO_URI)
  .then(() => console.log("Connected Successfully"))
  .catch(err => console.error("Connection Error:", err));

// --- ROUTES ---
// The error was here. This line is now clean:
app.post('/sign-pdf', signPdfController);

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});