const mongoose = require('mongoose');

const pdfRecordSchema = new mongoose.Schema({
  originalHash: String, 
  finalHash: String,    
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('PdfRecord', pdfRecordSchema);