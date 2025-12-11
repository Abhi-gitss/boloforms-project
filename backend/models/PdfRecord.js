// models/PdfRecord.js
const mongoose = require('mongoose');

const pdfRecordSchema = new mongoose.Schema({
  pdfId: { type: String, default: null },
  originalHash: { type: String, required: true, index: true },
  finalHash: { type: String, required: true, index: true },
  createdAt: { type: Date, default: Date.now }
});

// Export the model
module.exports = mongoose.model('PdfRecord', pdfRecordSchema);
