import React, { useState, useRef, useEffect } from 'react';
import { Camera, Users, CheckCircle, AlertCircle, LogOut, LayoutDashboard, UserPlus, X, Trash2, UserCheck, RefreshCw, CameraOff, ScanFace } from 'lucide-react';
import PhotoCapture from "../components/photocapture.jsx";

export default function Dashboard({ onLogout }) {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [showAddModal, setShowAddModal] = useState(false);

  // Initialize state from localStorage
  const [students, setStudents] = useState(() => {
    const saved = localStorage.getItem('ai_attendance_students');
    return saved ? JSON.parse(saved) : [];
  });

  // Sync students data to localStorage whenever students array updates
  useEffect(() => {
    localStorage.setItem('ai_attendance_students', JSON.stringify(students));
  }, [students]);

  const [cameraError, setCameraError] = useState(null);
  
  // State for detected faces history
  const [detectedFaces, setDetectedFaces] = useState([]);

  const [formData, setFormData] = useState({
    name: '',
    rollId: '',
    department: '',
    customDepartment: '',
    image: null,
  });

  const videoRef = useRef(null);

  // Live Monitoring Camera Initialization
  useEffect(() => {
    let streamInstance = null;

    async function startCamera() {
      if (activeTab !== 'dashboard') return;
      
      setCameraError(null);
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' }
        });
        
        streamInstance = stream;

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadedmetadata = () => {
            videoRef.current.play().catch(err => console.error("Video play error:", err));
          };
        }
      } catch (err) {
        console.error("Camera access error:", err);
        setCameraError("Unable to access camera. Check browser permissions.");
      }
    }

    startCamera();

    return () => {
      if (streamInstance) {
        streamInstance.getTracks().forEach((track) => track.stop());
      }
    };
  }, [activeTab]);

  const handleAddStudent = (e) => {
    e.preventDefault();
    if (!formData.name || !formData.rollId || !formData.department) return;

    const finalDepartment = formData.department === 'Other'
      ? formData.customDepartment || 'Other'
      : formData.department;

    const newStudent = {
      id: formData.rollId,
      name: formData.name,
      department: finalDepartment,
      status: 'Registered',
      image: formData.image,
    };

    setStudents([newStudent, ...students]);
    setFormData({ name: '', rollId: '', department: '', customDepartment: '', image: null });
    setShowAddModal(false);
  };

  const handleDeleteStudent = (id) => {
    setStudents(students.filter((student) => student.id !== id));
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex">
      {/* Sidebar */}
      <aside className="w-64 bg-slate-900 border-r border-slate-800 p-4 flex flex-col justify-between shrink-0">
        <div>
          <div className="flex items-center gap-3 px-2 py-4 mb-6">
            <Camera className="w-6 h-6 text-blue-500" />
            <span className="font-bold text-lg">AI Attendance</span>
          </div>
          <nav className="space-y-1">
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg font-medium transition cursor-pointer ${
                activeTab === 'dashboard' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-800'
              }`}
            >
              <LayoutDashboard className="w-5 h-5" /> Dashboard
            </button>
            <button
              onClick={() => setActiveTab('students')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg font-medium transition cursor-pointer ${
                activeTab === 'students' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-800'
              }`}
            >
              <Users className="w-5 h-5" />Register Students ({students.length})
            </button>
          </nav>
        </div>
        <button
          onClick={onLogout}
          className="flex items-center gap-3 px-3 py-2.5 text-rose-400 hover:bg-slate-800 rounded-lg transition w-full cursor-pointer"
        >
          <LogOut className="w-5 h-5" /> Logout
        </button>
      </aside>

      {/* Main Container */}
      <main className="flex-1 p-8 space-y-6 overflow-y-auto">
        {activeTab === 'dashboard' ? (
          <>
            <header className="flex justify-between items-center">
              <div>
                <h1 className="text-2xl font-bold">Live Monitoring</h1>
                <p className="text-slate-400 text-sm">Real-time facial recognition tracking</p>
              </div>
              <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-sm ${
                cameraError 
                  ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' 
                  : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
              }`}>
                <span className={`w-2 h-2 rounded-full ${cameraError ? 'bg-rose-500' : 'bg-emerald-500 animate-pulse'}`}></span>
                {cameraError ? 'Camera Error' : 'Camera Feed Active'}
              </div>
            </header>

            {/* Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl flex items-center gap-4">
                <div className="p-3 bg-blue-500/10 text-blue-500 rounded-lg">
                  <Users className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-xs text-slate-400">Total Registered</p>
                  <p className="text-xl font-bold">{students.length}</p>
                </div>
              </div>
              <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl flex items-center gap-4">
                <div className="p-3 bg-emerald-500/10 text-emerald-500 rounded-lg">
                  <CheckCircle className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-xs text-slate-400">Present Today</p>
                  <p className="text-xl font-bold">0</p>
                </div>
              </div>
              <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl flex items-center gap-4">
                <div className="p-3 bg-rose-500/10 text-rose-500 rounded-lg">
                  <AlertCircle className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-xs text-slate-400">Absent Today</p>
                  <p className="text-xl font-bold">0</p>
                </div>
              </div>
            </div>

            {/* Viewfinder Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col justify-between">
                <div className="flex justify-between items-center mb-3">
                  <h2 className="text-base font-semibold flex items-center gap-2">
                    <Camera className="w-4 h-4 text-blue-400" /> Recognition Viewfinder
                  </h2>
                  {!cameraError && (
                    <span className="text-[11px] font-mono text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20 flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
                      30 FPS
                    </span>
                  )}
                </div>

                <div className="relative w-full aspect-video max-h-[460px] bg-slate-950 rounded-lg border border-slate-800/80 overflow-hidden flex items-center justify-center">
                  {cameraError ? (
                    <div className="text-center p-6 text-slate-400 space-y-2">
                      <CameraOff className="w-10 h-10 mx-auto text-rose-500 mb-2" />
                      <p className="text-sm font-medium text-slate-300">{cameraError}</p>
                      <p className="text-xs text-slate-500">Ensure camera permissions are allowed in browser settings.</p>
                    </div>
                  ) : (
                    <>
                      <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        muted
                        className="w-full h-full object-cover"
                      />
                    </>
                  )}
                </div>
              </div>

              {/* Live Recognition Logs */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col">
                <div className="flex justify-between items-center mb-3">
                  <h3 className="text-base font-semibold">Recent Logs</h3>
                  <RefreshCw className="w-4 h-4 text-slate-500 cursor-pointer hover:text-slate-300 transition" />
                </div>
                <div className="flex-1 bg-slate-950 border border-slate-800/80 rounded-lg p-3 overflow-y-auto space-y-2.5 max-h-[460px]">
                  <div className="text-xs text-slate-500 text-center py-8">
                    No detections recorded yet. Recognized students will appear here in real-time.
                  </div>
                </div>
              </div>
            </div>

            {/* Detected Faces Panel */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
              <div className="flex justify-between items-center border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <ScanFace className="w-5 h-5 text-blue-400" />
                  <h3 className="text-base font-semibold text-white">Detected Faces</h3>
                </div>
                <span className="text-xs font-mono bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2.5 py-1 rounded-full">
                  {detectedFaces.length} Faces Detected
                </span>
              </div>

              {detectedFaces.length === 0 ? (
                <div className="text-center py-8 bg-slate-950 border border-slate-800/80 rounded-lg">
                  <ScanFace className="w-10 h-10 text-slate-600 mx-auto mb-2 opacity-50" />
                  <p className="text-sm font-medium text-slate-400">No faces currently detected</p>
                  <p className="text-xs text-slate-600 mt-0.5">Detected face crops and recognition scores will populate here automatically.</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                  {detectedFaces.map((face, index) => (
                    <div key={index} className="bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-center flex flex-col items-center space-y-2">
                      <div className="relative w-16 h-16 rounded-full overflow-hidden border-2 border-emerald-500/50 bg-slate-900">
                        {face.image ? (
                          <img src={face.image} alt="Detected face" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-slate-600">
                            <ScanFace className="w-8 h-8" />
                          </div>
                        )}
                      </div>
                      <div className="w-full space-y-0.5">
                        <p className="text-xs font-semibold text-white truncate">{face.name || 'Unknown'}</p>
                        <p className="text-[10px] font-mono text-blue-400 truncate">{face.id || 'N/A'}</p>
                        <p className="text-[10px] text-emerald-400 font-mono bg-emerald-500/10 rounded px-1.5 py-0.5 inline-block">
                          {face.confidence || '0.0'}%
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        ) : (
          <>
            <header className="flex justify-between items-center">
              <div>
                <h1 className="text-2xl font-bold">Student Directory</h1>
                <p className="text-slate-400 text-sm">Register new student profiles and reference photos</p>
              </div>
              <button
                onClick={() => setShowAddModal(true)}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg font-medium transition cursor-pointer"
              >
                <UserPlus className="w-5 h-5" /> Add Student
              </button>
            </header>

            {/* Directory Table */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
              {students.length === 0 ? (
                <div className="p-12 text-center text-slate-500">
                  <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p className="font-medium">No students registered yet</p>
                  <p className="text-xs text-slate-600 mt-1">Click "+ Add Student" above to upload new entries.</p>
                </div>
              ) : (
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-800 text-slate-400 border-b border-slate-700">
                    <tr>
                      <th className="p-4">Photo</th>
                      <th className="p-4">Roll ID</th>
                      <th className="p-4">Name</th>
                      <th className="p-4">Department</th>
                      <th className="p-4">Status</th>
                      <th className="p-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {students.map((student) => (
                      <tr key={student.id} className="hover:bg-slate-800/50 transition">
                        <td className="p-4">
                          {student.image ? (
                            <img src={student.image} alt={student.name} className="w-8 h-8 rounded-full object-cover border border-slate-700" />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-xs text-slate-400">
                              N/A
                            </div>
                          )}
                        </td>
                        <td className="p-4 font-mono text-blue-400">{student.id}</td>
                        <td className="p-4 font-medium text-white">{student.name}</td>
                        <td className="p-4 text-slate-400">{student.department}</td>
                        <td className="p-4">
                          <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20">
                            {student.status}
                          </span>
                        </td>
                        <td className="p-4 text-right">
                          <button
                            onClick={() => handleDeleteStudent(student.id)}
                            className="p-1.5 text-slate-500 hover:text-rose-400 transition rounded-lg hover:bg-slate-800 cursor-pointer"
                            title="Delete Student"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </>
        )}
      </main>

      {/* Add Student Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 w-full max-w-md shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-bold text-white">Register New Student</h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-white transition">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddStudent} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. John Doe"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-sm text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Roll / Student ID</label>
                <input
                  type="text"
                  required
                  value={formData.rollId}
                  onChange={(e) => setFormData({ ...formData, rollId: e.target.value })}
                  placeholder="e.g. STU001"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-sm text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Department</label>
                <select
                  required
                  value={formData.department}
                  onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                  className={`w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-sm focus:outline-none focus:border-blue-500 transition cursor-pointer ${
                    formData.department === '' ? 'text-slate-500' : 'text-white'
                  }`}
                >
                  <option value="" disabled hidden>
                    Select Department
                  </option>
                  <option value="BBA" className="text-white bg-slate-900">BBA</option>
                  <option value="BCA" className="text-white bg-slate-900">BCA</option>
                  <option value="MBA" className="text-white bg-slate-900">MBA</option>
                  <option value="MCA" className="text-white bg-slate-900">MCA</option>
                  <option value="Other" className="text-white bg-slate-900">Other</option>
                </select>

                {formData.department === 'Other' && (
                  <input
                    type="text"
                    required
                    value={formData.customDepartment}
                    onChange={(e) => setFormData({ ...formData, customDepartment: e.target.value })}
                    placeholder="Enter custom department name..."
                    className="mt-2 w-full bg-slate-950 border border-blue-500/50 rounded-lg p-2.5 text-sm text-white focus:outline-none focus:border-blue-500"
                  />
                )}
              </div>

              {/* Single Image Preview Component in Dashboard */}
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-2">
                  Facial Image Reference
                </label>
                
                {formData.image && (
                  <div className="relative mb-3 rounded-lg overflow-hidden border border-slate-800 bg-slate-950 flex items-center justify-center p-2">
                    <img
                      src={formData.image}
                      alt="Captured Reference"
                      className="max-h-36 rounded object-contain"
                    />
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, image: null })}
                      className="absolute top-2 right-2 bg-rose-500/80 hover:bg-rose-600 text-white p-1 rounded-full text-xs transition cursor-pointer"
                      title="Remove image"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}

                <PhotoCapture
                  onPhotoSelect={(imgData) => setFormData({ ...formData, image: imgData })}
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 py-2.5 rounded-lg text-sm transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-medium py-2.5 rounded-lg text-sm transition cursor-pointer"
                >
                  Save Student
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}