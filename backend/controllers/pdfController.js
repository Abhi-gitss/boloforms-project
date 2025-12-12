const { PDFDocument } = require('pdf-lib');
const crypto = require('crypto');
const PdfRecord = require('../models/PdfRecord'); 

const signPdfController = async (req, res) => {
  try {
    // 1. PAYLOAD: Receive data from frontend
    const { pdfId, signatureImageBase64, coordinates, pdfBase64 } = req.body;

    if (!pdfBase64) {
        return res.status(400).json({ message: "No PDF data received." });
    }
    
    // 2. PREPARE PDF: Clean prefix and load
    const cleanPdfBase64 = pdfBase64.replace(/^data:application\/pdf;base64,/, "");
    const existingPdfBytes = Buffer.from(cleanPdfBase64, 'base64');

    // 3. SECURITY: Audit Trail (Hash Original) [Requirement: 89]
    const originalHash = crypto.createHash('sha256').update(existingPdfBytes).digest('hex');

    // 4. LOAD DOCUMENT
    const pdfDoc = await PDFDocument.load(existingPdfBytes);
    const pages = pdfDoc.getPages();
    const firstPage = pages[0];

    // Get the real PDF dimensions (e.g., A4 size in points)
    const { width: pdfPageWidth, height: pdfPageHeight } = firstPage.getSize();

    // 5. PROCESS SIGNATURE: Handle PNG/JPEG & Clean Data
    const cleanSigBase64 = signatureImageBase64.replace(/^data:image\/\w+;base64,/, "");
    const imageBuffer = Buffer.from(cleanSigBase64, 'base64');

    let signatureImage;
    if (signatureImageBase64.startsWith('data:image/jpeg') || signatureImageBase64.startsWith('data:image/jpg')) {
        signatureImage = await pdfDoc.embedJpg(imageBuffer);
    } else {
        signatureImage = await pdfDoc.embedPng(imageBuffer);
    }

    // Get original dimensions of the uploaded signature image
    const sigDims = signatureImage.scale(1);

    // --- MATH SECTION: COORDINATES ---
    // Map the percentage coordinates (from Frontend) to real PDF points
    const xCoords = (coordinates.xPercent / 100) * pdfPageWidth;
    
    // PDF Y-axis starts at bottom-left, Browser starts top-left. We must flip it.
    const yDistanceFromTop = (coordinates.yPercent / 100) * pdfPageHeight;
    const yCoords = pdfPageHeight - yDistanceFromTop;

    // --- MATH SECTION: ASPECT RATIO CONSTRAINT [Requirement: 86] ---
    // 1. Calculate the dimensions of the box the user drew
    const boxWidth = (coordinates.widthPercent / 100) * pdfPageWidth;
    const boxHeight = (coordinates.heightPercent / 100) * pdfPageHeight;

    // 2. Calculate ratios to fit the image INSIDE the box
    const widthRatio = boxWidth / sigDims.width;
    const heightRatio = boxHeight / sigDims.height;
    
    // 3. Use Math.min to ensure the image is "Contained" (fits the smallest dimension)
    // This prevents stretching or distortion.
    const scaleFactor = Math.min(widthRatio, heightRatio);

    const finalWidth = sigDims.width * scaleFactor;
    const finalHeight = sigDims.height * scaleFactor;

    // 4. Calculate Offsets to CENTER the image in the box
    const xOffset = (boxWidth - finalWidth) / 2;
    const yOffset = (boxHeight - finalHeight) / 2;

    // 6. DRAW: Overlay the image onto the PDF
    firstPage.drawImage(signatureImage, {
      x: xCoords + xOffset,
      y: yCoords - finalHeight - yOffset, // Adjust Y because drawImage anchors at bottom-left
      width: finalWidth,
      height: finalHeight,
    });

    // 7. FINALIZE: Save and Hash [Requirement: 90]
    const pdfBytes = await pdfDoc.save();
    const finalHash = crypto.createHash('sha256').update(Buffer.from(pdfBytes)).digest('hex');

    // 8. DB: Store the Audit Trail [Requirement: 91]
    const newRecord = new PdfRecord({
      originalHash,
      finalHash,
      createdAt: new Date()
    });
    await newRecord.save();

    // 9. OUTPUT: Return the signed PDF
    const finalPdfBase64 = Buffer.from(pdfBytes).toString('base64');
    res.json({ success: true, pdf: finalPdfBase64 });

  } catch (error) {
    console.error("Error signing PDF:", error);
    res.status(500).json({ message: "Error signing PDF: " + error.message });
  }
};

module.exports = { signPdfController };