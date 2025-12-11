// controllers/pdfController.js
// Purpose: receive a PDF and a signature image (both as data URLs),
// place the signature in the requested area and return the signed PDF (base64).
// Also store simple audit info (orig / final hashes).

const { PDFDocument } = require('pdf-lib');
const crypto = require('crypto');
const PdfRecord = require('../models/PdfRecord');

async function signPdfController(req, res) {
  try {
    // --- 1. get the payload ---
    const { pdfId, signatureImageBase64, coordinates, pdfBase64 } = req.body;

    if (!pdfBase64) {
      return res.status(400).json({ message: 'Missing pdfBase64 in request.' });
    }
    if (!signatureImageBase64) {
      return res.status(400).json({ message: 'Missing signatureImageBase64 in request.' });
    }
    // coordinates expected shape:
    // { xPercent, yPercent, widthPercent, heightPercent, page? }
    if (!coordinates || typeof coordinates.xPercent !== 'number') {
      return res.status(400).json({ message: 'Invalid coordinates.' });
    }

    // --- 2. decode the incoming PDF data URL ---
    // Accept formats like: data:application/pdf;base64,.... or a raw base64 string.
    const cleanedPdfBase64 = pdfBase64.replace(/^data:application\/pdf;base64,/, '').trim();
    const pdfBuffer = Buffer.from(cleanedPdfBase64, 'base64');

    // --- 3. original hash for audit ---
    const originalHash = crypto.createHash('sha256').update(pdfBuffer).digest('hex');

    // --- 4. load PDF ---
    const pdfDoc = await PDFDocument.load(pdfBuffer);
    const pages = pdfDoc.getPages();
    const pageIndex = (coordinates.page && coordinates.page - 1) || 0;
    if (pageIndex < 0 || pageIndex >= pages.length) {
      return res.status(400).json({ message: 'Invalid page number in coordinates.' });
    }
    const page = pages[pageIndex];

    // get page size in PDF points
    const { width: pdfPageWidth, height: pdfPageHeight } = page.getSize();

    // --- 5. prepare signature image ---
    const cleanedSig = signatureImageBase64.replace(/^data:image\/\w+;base64,/, '').trim();
    const sigBuffer = Buffer.from(cleanedSig, 'base64');

    let embeddedImage;
    if (signatureImageBase64.startsWith('data:image/jpeg') || signatureImageBase64.startsWith('data:image/jpg')) {
      embeddedImage = await pdfDoc.embedJpg(sigBuffer);
    } else {
      // default to PNG for safety
      embeddedImage = await pdfDoc.embedPng(sigBuffer);
    }

    // dimensions of the embedded image (in PDF points)
    const sigDims = embeddedImage.scale(1); // { width, height }

    // --- 6. convert percent coords -> PDF points ---
    const boxWidthPts = (coordinates.widthPercent / 100) * pdfPageWidth;
    const boxHeightPts = (coordinates.heightPercent / 100) * pdfPageHeight;
    const boxLeftPts = (coordinates.xPercent / 100) * pdfPageWidth;
    // Browser yPercent is from top, PDF origin is bottom-left.
    // So compute y distance from top, then flip:
    const yDistanceFromTopPts = (coordinates.yPercent / 100) * pdfPageHeight;
    const boxBottomPts = pdfPageHeight - yDistanceFromTopPts - boxHeightPts;

    // --- 7. fit signature into the box while preserving aspect ratio ---
    const scaleX = boxWidthPts / sigDims.width;
    const scaleY = boxHeightPts / sigDims.height;
    const scale = Math.min(scaleX, scaleY, 1); // don't upscale beyond natural size
    const finalWidth = sigDims.width * scale;
    const finalHeight = sigDims.height * scale;

    // center the image inside the box
    const xDraw = boxLeftPts + (boxWidthPts - finalWidth) / 2;
    const yDraw = boxBottomPts + (boxHeightPts - finalHeight) / 2;

    // --- 8. draw to page ---
    page.drawImage(embeddedImage, {
      x: xDraw,
      y: yDraw,
      width: finalWidth,
      height: finalHeight
    });

    // --- 9. save final PDF and compute final hash ---
    const finalPdfBytes = await pdfDoc.save();
    const finalHash = crypto.createHash('sha256').update(Buffer.from(finalPdfBytes)).digest('hex');

    // --- 10. save audit record (minimal) ---
    const record = new PdfRecord({
      pdfId: pdfId || null,
      originalHash,
      finalHash
    });
    await record.save().catch(err => {
      // don't block the response if DB logging fails — just log locally
      console.error('Failed to save PdfRecord:', err.message);
    });

    // --- 11. return base64 to client ---
    const finalBase64 = Buffer.from(finalPdfBytes).toString('base64');
    return res.json({ success: true, pdf: finalBase64, originalHash, finalHash });

  } catch (err) {
    console.error('Error in signPdfController:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
}

module.exports = { signPdfController };
