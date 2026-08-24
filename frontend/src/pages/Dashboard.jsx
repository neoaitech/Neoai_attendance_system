import React, { useState } from 'react';
import { Camera, Users, CheckCircle, AlertCircle, LogOut, LayoutDashboard, UserPlus, X, Trash2 } from 'lucide-react';
import PhotoCapture from './PhotoCapture.jsx';

export default function Dashboard({ onLogout }) {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [showAddModal, setShowAddModal] = useState(false);
  const [students, setStudents] = useState([]); // Starts empty for admin uploads

  const [formData, setFormData] = useState({
    name: '',
    rollId: '',
    department: 'Computer Science',
    image: null,
  });

  const handleAddStudent = (e) => {
    e.preventDefault();
    if (!formData.name || !formData.rollId) return;

    const newStudent = {
      id: formData.rollId,
      name: formData.name,
      department: formData.department,
      status: 'Registered',
      image: formData.image,
    };

    setStudents([newStudent, ...students]);
    setFormData({ name: '', rollId: '', department: 'Computer Science', image: null });
    setShowAddModal(false);
  };

  const handleDeleteStudent = (id) => {
    setStudents(students.filter((student) => student.id !== id));
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex">
      {/* Sidebar */}
      <aside className="w-64 bg-slate-900 border-r border-slate-800 p-4 flex flex-col justify-between">
        <div>
          <div className="flex items-center gap-3 px-2 py-4 mb-6">
            <Camera className="w-6 h-6 text-blue-500" />
            <span className="font-bold text-lg">AI Attendance</span>
          </div>
          <nav className="space-y-1">
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg font-medium transition ${
                activeTab === 'dashboard' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-800'
              }`}
            >
              <LayoutDashboard className="w-5 h-5" /> Dashboard
            </button>
            <button
              onClick={() => setActiveTab('students')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg font-medium transition ${
                activeTab === 'students' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-800'
              }`}
            >
              <Users className="w-5 h-5" /> Students ({students.length})
            </button>
          </nav>
        </div>
        <button
          onClick={onLogout}
          className="flex items-center gap-3 px-3 py-2.5 text-rose-400 hover:bg-slate-800 rounded-lg transition w-full"
        >
          <LogOut className="w-5 h-5" /> Logout
        </button>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-8 space-y-8 overflow-y-auto">
        {activeTab === 'dashboard' ? (
          <>
            <header className="flex justify-between items-center">
              <div>
                <h1 className="text-2xl font-bold">Live Monitoring</h1>
                <p className="text-slate-400 text-sm">Real-time facial recognition tracking</p>
              </div>
              <div className="flex items-center gap-2 bg-emerald-500/10 text-emerald-400 px-3 py-1.5 rounded-full border border-emerald-500/20 text-sm">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                Camera Feed Active
              </div>
            </header>

            {/* Metrics Grid */}
            <div className="grid grid-cols-3 gap-6">
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

            {/* Recognition Viewfinder */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
              <h2 className="text-lg font-semibold mb-4">Recognition Viewfinder</h2>
              <div className="relative aspect-video bg-slate-950 rounded-lg border border-slate-800 flex items-center justify-center overflow-hidden">
                <p className="text-slate-500">Processing RTSP Camera Feed...</p>
              </div>
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
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg font-medium transition"
              >
                <UserPlus className="w-5 h-5" /> Add Student
              </button>
            </header>

            {/* Student Directory Table */}
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
                      <tr key={student.id} className="hover:bg-slate-800/50">
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
                            className="p-1.5 text-slate-500 hover:text-rose-400 transition rounded-lg hover:bg-slate-800"
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
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-white">
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
                  value={formData.department}
                  onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-sm text-white focus:outline-none focus:border-blue-500"
                >
                  <option>Computer Science</option>
                  <option>Information Technology</option>
                  <option>Electronics</option>
                  <option>Mechanical Engineering</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-2">
                  Facial Image Reference
                </label>
                <PhotoCapture
                  onPhotoSelect={(imgData) => setFormData({ ...formData, image: imgData })}
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 py-2.5 rounded-lg text-sm transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-medium py-2.5 rounded-lg text-sm transition"
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