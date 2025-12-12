import React, { useState, useRef, useEffect } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { Rnd } from 'react-rnd';
import axios from 'axios';
import './App.css';

// Fix for PDF worker
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

function App() {
  const [pdfFile, setPdfFile] = useState(null);
  const [signatureFile, setSignatureFile] = useState(null); 
  
  // --- RESPONSIVE STATE ---
  // We store position/size as PERCENTAGES (0 to 100)
  // This ensures the box stays anchored regardless of screen size 
  const [boxState, setBoxState] = useState({ x: 0, y: 0, width: 20, height: 10 }); 

  const pdfContainerRef = useRef(null);

  // Helper to get current container pixel dimensions
  const getContainerSize = () => {
    if (pdfContainerRef.current) {
      return pdfContainerRef.current.getBoundingClientRect();
    }
    return { width: 0, height: 0 };
  };

  const fileToBase64 = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result); 
      reader.onerror = error => reject(error);
    });
  };

  const onPdfChange = (e) => {
    const file = e.target.files[0];
    if (file) setPdfFile(file);
  };

  const onSignatureChange = (e) => {
    const file = e.target.files[0];
    if (file) setSignatureFile(file);
  };

  const handleSave = async () => {
    if (!pdfFile || !signatureFile) {
      alert(" upload PDF and Signature.");
      return;
    }

    try {
      const signatureBase64 = await fileToBase64(signatureFile);
      const pdfBase64 = await fileToBase64(pdfFile);

      // The state is already in %, so we just rename keys to match backend expectation
      const coordinates = {
        xPercent: boxState.x,
        yPercent: boxState.y,
        widthPercent: boxState.width,
        heightPercent: boxState.height,
      };

      const payload = {
        pdfId: "123",
        pdfBase64: pdfBase64,
        signatureImageBase64: signatureBase64, 
        coordinates: coordinates
      };

      const response = await axios.post('https://boloforms-project.onrender.com/', payload);

      if (response.data.success) {
        const link = document.createElement('a');
        link.href = `data:application/pdf;base64,${response.data.pdf}`;
        link.download = 'signed_document.pdf';
        link.click();
        alert("Success! PDF Signed.");
      }
    } catch (error) {
      console.error(error);
      alert("Failed.");
    }
  };

  return (
    <div className="App">
      <h2>BoloForms Responsive Prototype</h2>
      
      <div className="controls">
        <input type="file" onChange={onPdfChange} accept="application/pdf" />
        <input type="file" onChange={onSignatureChange} accept="image/png, image/jpeg" style={{marginLeft: '10px'}}/>
        <button onClick={handleSave} style={{marginLeft: '10px', background: 'blue', color: 'white'}}>Save</button>
      </div>

      <div className="workspace" style={{marginTop: '20px', display: 'flex', justifyContent: 'center'}}>
        {pdfFile && (
          // Container must be relative so children are positioned inside it
          <div className="pdf-container" ref={pdfContainerRef} style={{position: 'relative', display: 'inline-block', width: '90%', border: '1px solid grey'}}>
            
            {/* React-PDF renders a canvas. 
              We set width to "100%" so it scales with the div (Responsive) 
            */}
            <Document file={pdfFile}>
              <Page 
                pageNumber={1} 
                renderTextLayer={false} 
                renderAnnotationLayer={false} 
                width={pdfContainerRef.current?.clientWidth || 600} // Dynamic Width
              />
            </Document>
            
            {/* RND COMPONENT
               We convert % state to Pixels for rendering, 
               but we convert Pixels back to % when dragging stops.
            */}
            <Rnd
              bounds="parent"
              // Render using percentages directly!
              size={{ width: `${boxState.width}%`, height: `${boxState.height}%` }}
              position={{ x: (boxState.x / 100) * (pdfContainerRef.current?.clientWidth || 0), y: (boxState.y / 100) * (pdfContainerRef.current?.clientHeight || 0) }}
              
              onDragStop={(e, d) => {
                const { width, height } = getContainerSize();
                // Convert Pixels -> Percent
                setBoxState(prev => ({
                  ...prev,
                  x: (d.x / width) * 100,
                  y: (d.y / height) * 100
                }));
              }}
              
              onResizeStop={(e, direction, ref, delta, position) => {
                const { width, height } = getContainerSize();
                // Convert Pixels -> Percent
                setBoxState({
                  width: (ref.offsetWidth / width) * 100,
                  height: (ref.offsetHeight / height) * 100,
                  x: (position.x / width) * 100,
                  y: (position.y / height) * 100
                });
              }}
              
              style={{
                border: '2px dashed red',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'rgba(255, 0, 0, 0.1)'
              }}
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