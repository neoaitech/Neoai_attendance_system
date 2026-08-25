import React, { useRef, useEffect, useState } from 'react';
import Webcam from 'react-webcam';
import { Camera, CheckCircle2, AlertCircle, RefreshCw, UserCheck } from 'lucide-react';

export default function RecognitionViewfinder({ onAttendanceMarked }) {
  const webcamRef = useRef(null);
  const canvasRef = useRef(null);
  const [isScanning, setIsScanning] = useState(true);
  const [recentLogs, setRecentLogs] = useState([]);
  const [lastDetected, setLastDetected] = useState(null);

  // Video constraints for Webcam
  const videoConstraints = {
    width: 1280,
    height: 720,
    facingMode: "user"
  };

  // Simulated detection loop (Replace box logic with face-api.js / backend response)
  const processFrame = () => {
    if (
      webcamRef.current &&
      webcamRef.current.video &&
      webcamRef.current.video.readyState === 4
    ) {
      const video = webcamRef.current.video;
      const canvas = canvasRef.current;
      if (!canvas) return;

      const videoWidth = video.videoWidth;
      const videoHeight = video.videoHeight;

      canvas.width = videoWidth;
      canvas.height = videoHeight;

      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, videoWidth, videoHeight);

      // --- OPTIONAL: Draw Target Scanning Overlay Grid ---
      ctx.strokeStyle = 'rgba(59, 130, 246, 0.3)'; // Soft blue
      ctx.lineWidth = 1;
      
      // Draw static center viewfinder target frame
      const boxWidth = 240;
      const boxHeight = 240;
      const x = (videoWidth - boxWidth) / 2;
      const y = (videoHeight - boxHeight) / 2;

      ctx.strokeStyle = '#3B82F6';
      ctx.lineWidth = 2;
      ctx.setLineDash([10, 10]); // Dashed line effect
      ctx.strokeRect(x, y, boxWidth, boxHeight);
      ctx.setLineDash([]); // Reset dash
    }
  };

  useEffect(() => {
    let interval;
    if (isScanning) {
      interval = setInterval(processFrame, 100); // 10 FPS scan loop
    }
    return () => clearInterval(interval);
  }, [isScanning]);

  // Handle Mock Detection Trigger (Connect this to your AI trigger)
  const handleSimulateDetection = (studentName = "Kamlesh") => {
    const timestamp = new Date().toLocaleTimeString();
    const newRecord = { id: Date.now(), name: studentName, time: timestamp };

    setLastDetected(studentName);
    setRecentLogs((prev) => [newRecord, ...prev.slice(0, 4)]); // Keep last 5

    if (onAttendanceMarked) {
      onAttendanceMarked(newRecord);
    }

    // Reset detected alert banner after 3 seconds
    setTimeout(() => {
      setLastDetected(null);
    }, 3000);
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-xl space-y-4">
      {/* Header Bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Camera className="w-5 h-5 text-blue-500" />
          <h2 className="text-lg font-semibold text-white">Recognition Viewfinder</h2>
        </div>
        
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5 text-xs text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            AI Engine Active
          </span>
          <button
            onClick={() => setIsScanning(!isScanning)}
            className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-1.5 rounded-lg border border-slate-700 transition"
          >
            {isScanning ? 'Pause Camera' : 'Resume Camera'}
          </button>
        </div>
      </div>

      {/* Main Grid Viewport */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        
        {/* Left: Video & Canvas Feed */}
        <div className="lg:col-span-2 relative aspect-video bg-slate-950 rounded-lg overflow-hidden border border-slate-800 flex items-center justify-center">
          {isScanning ? (
            <>
              <Webcam
                ref={webcamRef}
                audio={false}
                screenshotFormat="image/jpeg"
                videoConstraints={videoConstraints}
                className="w-full h-full object-cover"
              />
              <canvas
                ref={canvasRef}
                className="absolute inset-0 w-full h-full pointer-events-none"
              />
              
              {/* Detection Alert Popup Overlay */}
              {lastDetected && (
                <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-emerald-600/90 text-white px-4 py-2 rounded-lg backdrop-blur-md shadow-lg flex items-center gap-2 text-sm font-medium animate-bounce">
                  <CheckCircle2 className="w-4 h-4" />
                  Recognized: {lastDetected}
                </div>
              )}
            </>
          ) : (
            <div className="text-center text-slate-500 space-y-2">
              <Camera className="w-10 h-10 mx-auto opacity-40" />
              <p className="text-sm">Camera feed is paused</p>
            </div>
          )}
        </div>

        {/* Right: Real-time Attendance Activity Log */}
        <div className="bg-slate-950 p-4 rounded-lg border border-slate-800 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3 border-b border-slate-800 pb-2">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <UserCheck className="w-4 h-4 text-blue-400" />
                Live Attendance Log
              </h3>
              <span className="text-[10px] text-slate-500">Auto-updating</span>
            </div>

            <div className="space-y-2">
              {recentLogs.length > 0 ? (
                recentLogs.map((log) => (
                  <div
                    key={log.id}
                    className="flex items-center justify-between p-2.5 rounded-md bg-slate-900 border border-slate-800/80 text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-emerald-400"></div>
                      <span className="font-medium text-slate-200">{log.name}</span>
                    </div>
                    <span className="text-slate-500 text-[11px]">{log.time}</span>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-slate-600 text-xs">
                  No attendance logged yet.
                </div>
              )}
            </div>
          </div>

          {/* Test Action Trigger (For UI Verification) */}
          <button
            onClick={() => handleSimulateDetection("Kamlesh")}
            className="mt-4 w-full py-2 bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 border border-blue-500/30 text-xs font-medium rounded-lg transition flex items-center justify-center gap-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Simulate Match Trigger
          </button>
        </div>

      </div>
    </div>
  );
}