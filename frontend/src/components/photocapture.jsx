import React, { useState, useRef, useCallback } from 'react';
import Webcam from 'react-webcam';
import { Camera, Upload, RefreshCw, CheckCircle, Image as ImageIcon } from 'lucide-react';

export default function photocapture({ onPhotoSelect }) {
  const [mode, setMode] = useState('upload'); // 'upload' | 'camera'
  const [preview, setPreview] = useState(null);
  const webcamRef = useRef(null);

  // Handle File Upload
  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreview(reader.result);
        onPhotoSelect(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  // Capture Image from Webcam
  const captureCamera = useCallback(() => {
    const imageSrc = webcamRef.current.getScreenshot();
    if (imageSrc) {
      setPreview(imageSrc);
      onPhotoSelect(imageSrc);
    }
  }, [webcamRef, onPhotoSelect]);

  // Reset Photo
  const resetPhoto = () => {
    setPreview(null);
    onPhotoSelect(null);
  };

  return (
    <div className="space-y-3">
      {/* Mode Selector Tabs */}
      <div className="flex bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs font-medium">
        <button
          type="button"
          onClick={() => { setMode('upload'); resetPhoto(); }}
          className={`flex-1 py-1.5 flex items-center justify-center gap-2 rounded-md transition ${
            mode === 'upload' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
          }`}
        >
          <Upload className="w-3.5 h-3.5" /> Upload File
        </button>
        <button
          type="button"
          onClick={() => { setMode('camera'); resetPhoto(); }}
          className={`flex-1 py-1.5 flex items-center justify-center gap-2 rounded-md transition ${
            mode === 'camera' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
          }`}
        >
          <Camera className="w-3.5 h-3.5" /> Live Camera
        </button>
      </div>

      {/* Main Preview Container */}
      <div className="relative aspect-square max-w-[240px] mx-auto bg-slate-950 rounded-xl border-2 border-dashed border-slate-800 flex items-center justify-center overflow-hidden">
        {preview ? (
          /* Preview View */
          <div className="relative w-full h-full group">
            <img src={preview} alt="Captured Student" className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-slate-950/60 opacity-0 group-hover:opacity-100 transition flex items-center justify-center gap-2">
              <button
                type="button"
                onClick={resetPhoto}
                className="bg-rose-600 hover:bg-rose-500 text-white p-2 rounded-lg text-xs flex items-center gap-1 transition"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Retake
              </button>
            </div>
            <div className="absolute top-2 right-2 bg-emerald-500 text-white p-1 rounded-full shadow-md">
              <CheckCircle className="w-4 h-4" />
            </div>
          </div>
        ) : mode === 'upload' ? (
          /* File Upload View */
          <label className="cursor-pointer p-4 text-center w-full h-full flex flex-col items-center justify-center hover:bg-slate-900/50 transition">
            <ImageIcon className="w-8 h-8 text-slate-500 mb-2" />
            <span className="text-xs text-slate-300 font-medium">Click to select photo</span>
            <span className="text-[10px] text-slate-500 mt-0.5">JPG, PNG or WEBP</span>
            <input type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
          </label>
        ) : (
          /* Live Webcam View */
          <div className="relative w-full h-full flex flex-col items-center justify-center">
            <Webcam
              audio={false}
              ref={webcamRef}
              screenshotFormat="image/jpeg"
              className="w-full h-full object-cover"
              videoConstraints={{ facingMode: 'user' }}
            />
            <button
              type="button"
              onClick={captureCamera}
              className="absolute bottom-3 bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 shadow-lg transition"
            >
              <Camera className="w-3.5 h-3.5" /> Capture Photo
            </button>
          </div>
        )}
      </div>
    </div>
  );
}