// src/App.js
import React, { useState, useRef } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { Rnd } from 'react-rnd';
import axios from 'axios';
import './App.css';

// pdf.worker fix for react-pdf
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

function App() {
  const [pdfFile, setPdfFile] = useState(null);
  const [signatureFile, setSignatureFile] = useState(null);
  const [boxState, setBoxState] = useState({ x: 5, y: 70, width: 30, height: 12 }); // default %
  const pdfContainerRef = useRef(null);

  const fileToDataUrl = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = (e) => reject(e);
    reader.readAsDataURL(file);
  });

  const onPdfChange = (e) => {
    const f = e.target.files?.[0];
    if (f && f.type === 'application/pdf') setPdfFile(f);
    else if (f) alert('Please choose a PDF file.');
  };

  const onSignatureChange = (e) => {
    const f = e.target.files?.[0];
    if (f && (f.type === 'image/png' || f.type === 'image/jpeg')) setSignatureFile(f);
    else if (f) alert('Signature must be PNG or JPEG.');
  };

  const getContainerSize = () => {
    const rect = pdfContainerRef.current?.getBoundingClientRect();
    return rect ? { width: rect.width, height: rect.height } : { width: 0, height: 0 };
  };

  const handleSave = async () => {
    if (!pdfFile || !signatureFile) {
      alert('Upload both PDF and signature first.');
      return;
    }
    try {
      const pdfDataUrl = await fileToDataUrl(pdfFile);
      const sigDataUrl = await fileToDataUrl(signatureFile);

      const payload = {
        pdfId: 'local',
        pdfBase64: pdfDataUrl,
        signatureImageBase64: sigDataUrl,
        coordinates: {
          xPercent: boxState.x,
          yPercent: boxState.y,
          widthPercent: boxState.width,
          heightPercent: boxState.height,
          page: 1
        }
      };

      const resp = await axios.post('http://localhost:5000/sign-pdf', payload, { timeout: 60000 });
      if (resp.data && resp.data.success) {
        const link = document.createElement('a');
        link.href = `data:application/pdf;base64,${resp.data.pdf}`;
        link.download = 'signed_document.pdf';
        link.click();
        alert('Signed PDF downloaded.');
      } else {
        alert('Server response did not contain signed PDF.');
      }
    } catch (err) {
      console.error('Failed to save signed PDF:', err);
      alert('Error while signing PDF. See console.');
    }
  };

  return (
    <div className="App" style={{ padding: 20 }}>
      <h2>BoloForms — small demo</h2>

      <div style={{ marginBottom: 12 }}>
        <input type="file" accept="application/pdf" onChange={onPdfChange} />
        <input type="file" accept="image/png, image/jpeg" onChange={onSignatureChange} style={{ marginLeft: 8 }} />
        <button onClick={handleSave} disabled={!pdfFile || !signatureFile} style={{ marginLeft: 8 }}>
          Save (Sign)
        </button>
      </div>

      <div>
        {pdfFile ? <div style={{ marginBottom: 8 }}>Selected PDF: {pdfFile.name}</div> : <div>Select a PDF to begin.</div>}
      </div>

      <div className="workspace" style={{ display: 'flex', justifyContent: 'center', marginTop: 12 }}>
        {pdfFile && (
          <div className="pdf-wrapper" ref={pdfContainerRef} style={{ position: 'relative', width: '80%', border: '1px solid #ddd' }}>
            <Document file={pdfFile}>
              <Page pageNumber={1} renderTextLayer={false} renderAnnotationLayer={false} width={pdfContainerRef.current?.clientWidth || 600} />
            </Document>

            <Rnd
              bounds="parent"
              size={{ width: `${boxState.width}%`, height: `${boxState.height}%` }}
              position={{ x: (boxState.x / 100) * (pdfContainerRef.current?.clientWidth || 0), y: (boxState.y / 100) * (pdfContainerRef.current?.clientHeight || 0) }}
              onDragStop={(e, d) => {
                const { width, height } = getContainerSize();
                setBoxState(prev => ({ ...prev, x: (d.x / width) * 100, y: (d.y / height) * 100 }));
              }}
              onResizeStop={(e, direction, ref, delta, position) => {
                const { width, height } = getContainerSize();
                setBoxState({
                  width: (ref.offsetWidth / width) * 100,
                  height: (ref.offsetHeight / height) * 100,
                  x: (position.x / width) * 100,
                  y: (position.y / height) * 100
                });
              }}
              style={{ border: '2px dashed #ff6b6b', background: 'rgba(255,107,107,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ff6b6b' }}
            >
              Sign
            </Rnd>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
