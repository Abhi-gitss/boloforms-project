// frontend/src/App.js
import React, { useState, useRef } from "react";
import { Document, Page } from "react-pdf";
import { Rnd } from "react-rnd";
import axios from "axios";
import "./App.css";

// Build-safe backend base URL (Vercel injects REACT_APP_BACKEND_URL at build time)
const BACKEND = (process.env.REACT_APP_BACKEND_URL || "http://localhost:5000").replace(/\/$/, "");

const fileToBase64 = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = (err) => reject(err);
  });

export default function App() {
  const [pdfFile, setPdfFile] = useState(null);
  const [signatureFile, setSignatureFile] = useState(null);
  const [boxState, setBoxState] = useState({ x: 5, y: 70, width: 20, height: 8 }); // percents
  const pdfContainerRef = useRef(null);

  const getContainerSize = () => {
    if (pdfContainerRef.current) {
      return pdfContainerRef.current.getBoundingClientRect();
    }
    return { width: 0, height: 0 };
  };

  const onPdfChange = (e) => {
    const f = e.target.files?.[0];
    if (f) setPdfFile(f);
  };

  const onSignatureChange = (e) => {
    const f = e.target.files?.[0];
    if (f) setSignatureFile(f);
  };

  const callSignPdf = async (payload) => {
    const url = `${BACKEND}/sign-pdf`;
    console.log("Posting to backend URL:", url);
    try {
      const res = await axios.post(url, payload, { timeout: 120000 });
      console.log("Backend response:", res.status, res.data);
      return res.data;
    } catch (err) {
      console.error("sign-pdf failed:", {
        status: err?.response?.status,
        data: err?.response?.data,
        message: err?.message,
        requestUrl: err?.config?.url,
      });
      throw err;
    }
  };

  const handleSave = async () => {
    if (!pdfFile || !signatureFile) {
      alert("Please upload both a PDF and a signature image.");
      return;
    }

    try {
      const signatureBase64 = await fileToBase64(signatureFile);
      const pdfBase64 = await fileToBase64(pdfFile);

      const coordinates = {
        xPercent: boxState.x,
        yPercent: boxState.y,
        widthPercent: boxState.width,
        heightPercent: boxState.height,
      };

      const payload = {
        pdfId: "client-generated-id-1",
        pdfBase64,
        signatureImageBase64: signatureBase64,
        coordinates,
      };

      // Log short preview
      console.log("Payload preview:", {
        pdfId: payload.pdfId,
        coords: payload.coordinates,
        pdf_b64_len: pdfBase64.length,
        sig_b64_len: signatureBase64.length,
      });

      const data = await callSignPdf(payload);

      // Expecting { success: true, pdf: "<base64>" } or similar
      if (data && data.pdf) {
        const link = document.createElement("a");
        link.href = `data:application/pdf;base64,${data.pdf}`;
        link.download = "signed_document.pdf";
        link.click();
        alert("Success! Signed PDF downloaded.");
      } else {
        console.warn("Backend returned no pdf field:", data);
        alert("Saved but no signed PDF returned. Check server logs.");
      }
    } catch (err) {
      alert("Failed to sign PDF. See console for details.");
    }
  };

  return (
    <div className="App" style={{ padding: 24, fontFamily: "Arial, sans-serif", textAlign: "center" }}>
      <h2>BoloForms — small demo</h2>

      <div className="controls" style={{ marginBottom: 12 }}>
        <input type="file" onChange={onPdfChange} accept="application/pdf" />
        <input type="file" onChange={onSignatureChange} accept="image/png, image/jpeg" style={{ marginLeft: 10 }} />
        <button onClick={handleSave} style={{ marginLeft: 10, background: "#1976d2", color: "#fff", border: "none", padding: "6px 12px", borderRadius: 4 }}>
          Save (Sign)
        </button>
      </div>

      <div style={{ marginTop: 20, display: "flex", justifyContent: "center" }}>
        {pdfFile ? (
          <div ref={pdfContainerRef} style={{ position: "relative", display: "inline-block", width: "90%", border: "1px solid #ddd", padding: 8 }}>
            <Document file={pdfFile}>
              <Page pageNumber={1} renderTextLayer={false} renderAnnotationLayer={false} width={pdfContainerRef.current?.clientWidth || 800} />
            </Document>

            <Rnd
              bounds="parent"
              size={{ width: `${boxState.width}%`, height: `${boxState.height}%` }}
              position={{
                x: (boxState.x / 100) * (pdfContainerRef.current?.clientWidth || 0),
                y: (boxState.y / 100) * (pdfContainerRef.current?.clientHeight || 0),
              }}
              onDragStop={(e, d) => {
                const { width, height } = getContainerSize();
                setBoxState((prev) => ({
                  ...prev,
                  x: Math.max(0, Math.min(100, (d.x / width) * 100)),
                  y: Math.max(0, Math.min(100, (d.y / height) * 100)),
                }));
              }}
              onResizeStop={(e, direction, ref, delta, position) => {
                const { width, height } = getContainerSize();
                setBoxState({
                  width: Math.max(1, Math.min(100, (ref.offsetWidth / width) * 100)),
                  height: Math.max(1, Math.min(100, (ref.offsetHeight / height) * 100)),
                  x: Math.max(0, Math.min(100, (position.x / width) * 100)),
                  y: Math.max(0, Math.min(100, (position.y / height) * 100)),
                });
              }}
              style={{
                border: "2px dashed rgba(220,0,0,0.9)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "rgba(255, 0, 0, 0.06)",
                color: "#c62828",
                fontWeight: "600",
                cursor: "move",
              }}
            >
              Sign
            </Rnd>
          </div>
        ) : (
          <div style={{ color: "#666" }}>Select a PDF to preview</div>
        )}
      </div>
    </div>
  );
}
