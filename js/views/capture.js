// ===================================================================
// VisionAttend - Take Attendance & Biometric Ingestion
// File: frontend/js/views/capture.js
// Upper Section: UNTOUCHED | Lower Section: Dedicated Multi-Division Verification
// ===================================================================

const CaptureView = {
  activeMode: "upload", // "upload", "camera"
  uploadedFiles: [],
  capturedClassroomSnaps: [],
  processedResult: null,
  activePhotoIndex: 0,
  galleryMode: "focus",
  currentZoom: 1.0,
  webcamStream: null,
  allClasses: [],
  cachedMeta: null,

  // Multi-Program State (No default selection)
  availablePrograms: ["BCA", "MCA", "MBA", "BBA", "BA", "MA", "B.Tech", "M.Tech"],
  selectedPrograms: new Set(),
  hasOtherProgram: false,
  isProgramDropdownOpen: false,

  // Multi-Semester State (No default selection)
  availableSemesters: ["Semester 1", "Semester 2", "Semester 3", "Semester 4", "Semester 5", "Semester 6", "Semester 7", "Semester 8"],
  selectedSemesters: new Set(),
  hasOtherSemester: false,
  isSemesterDropdownOpen: false,

  // Multi-Division State (No default selection)
  availableDivisions: ["A", "B", "C", "D"],
  selectedDivisions: new Set(),
  hasOtherDivision: false,
  isDivisionDropdownOpen: false,

  // Verification Active Filter
  activeVerificationFilter: "all",

  // Institutional Biometric Lock State
  institutionalTolerance: 0.50,
  institutionalToleranceLabel: "Standard Balanced (0.50 - Recommended)",
  showAllUnknowns: false,

  async render(container) {
    this.activeMode = "upload";
    this.uploadedFiles = [];
    this.capturedClassroomSnaps = [];
    this.processedResult = null;
    this.activePhotoIndex = 0;
    this.currentZoom = 1.0;
    this.galleryMode = "focus";
    this.selectedPrograms = new Set();
    this.hasOtherProgram = false;
    this.isProgramDropdownOpen = false;
    this.selectedSemesters = new Set();
    this.hasOtherSemester = false;
    this.isSemesterDropdownOpen = false;
    this.selectedDivisions = new Set();
    this.hasOtherDivision = false;
    this.isDivisionDropdownOpen = false;
    this.activeVerificationFilter = "all";
    this.showAllUnknowns = false;

    container.innerHTML = `
      <!-- Page Header -->
      <div class="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <div class="flex items-center gap-2.5 mb-1.5 flex-wrap">
            <h2 class="text-2xl font-extrabold text-slate-900 tracking-tight" style="letter-spacing: -0.02em;">Take Attendance</h2>
            <div class="flex items-center gap-1.5 flex-wrap">
              <span class="badge" style="background: rgba(99, 102, 241, 0.09); color: #4f46e5; border: 1px solid rgba(99, 102, 241, 0.25); font-size: 0.72rem; font-weight: 700; padding: 3px 9px;">
                ⚡ YOLOv8 Face
              </span>
              <span class="badge" style="background: rgba(16, 185, 129, 0.09); color: #059669; border: 1px solid rgba(16, 185, 129, 0.25); font-size: 0.72rem; font-weight: 700; padding: 3px 9px;">
                🛡️ MiniFASNet Anti-Spoof
              </span>
              <span class="badge" style="background: rgba(139, 92, 246, 0.09); color: #7c3aed; border: 1px solid rgba(139, 92, 246, 0.25); font-size: 0.72rem; font-weight: 700; padding: 3px 9px;">
                🎯 ArcFace 512-D
              </span>
            </div>
          </div>
          <p class="text-xs text-slate-500 font-medium max-w-3xl">Multi-angle panoramic biometric ingestion. Upload or capture 1–8 classroom angles for real-time facial feature extraction and multi-division attendance aggregation.</p>
        </div>
        <div class="flex items-center gap-2">
          <div style="background: #ffffff; border: 1px solid rgba(0,0,0,0.08); padding: 6px 14px; border-radius: 12px; box-shadow: 0 2px 5px rgba(0,0,0,0.03); display: flex; align-items: center; gap: 8px;">
            <div style="width: 8px; height: 8px; border-radius: 50%; background: #10b981; box-shadow: 0 0 6px #10b981;"></div>
            <span style="font-size: 0.75rem; font-weight: 700; color: #334155;">
              ${new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
            </span>
          </div>
        </div>
      </div>

      <!-- Main Form & Ingestion Config Panel -->
      <form id="multi-capture-form">
        <div class="capture-config-panel">
          
          <!-- Panel Header -->
          <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid #f1f5f9; padding-bottom: 14px; margin-bottom: 16px; flex-wrap: wrap; gap: 10px;">
            <div style="display: flex; align-items: center; gap: 10px;">
              <div style="width: 36px; height: 36px; border-radius: 10px; background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%); color: #ffffff; display: flex; align-items: center; justify-content: center; font-weight: 800; box-shadow: 0 4px 12px rgba(99, 102, 241, 0.25);">
                <i data-lucide="layers" style="width: 18px; height: 18px;"></i>
              </div>
              <div>
                <h3 style="font-size: 0.98rem; font-weight: 800; color: #0f172a; margin: 0; line-height: 1.2;">
                  Lecture Setup & Target Class
                </h3>
                <span style="font-size: 0.72rem; color: #64748b; font-weight: 500;">
                  Select class to automatically load enrolled students for instant AI verification
                </span>
              </div>
            </div>
            
            <!-- Live Active Roster Badge -->
            <div id="roster-active-indicator" style="display: flex; align-items: center; gap: 8px;">
              <span class="badge" style="background: #ecfdf5; color: #065f46; border: 1px solid #a7f3d0; font-size: 0.74rem; font-weight: 800; padding: 5px 10px; border-radius: 8px; display: inline-flex; align-items: center; gap: 5px; box-shadow: 0 1px 3px rgba(16, 185, 129, 0.1);">
                <i data-lucide="shield-check" style="width: 14px; height: 14px; color: #059669;"></i>
                <span id="active-roster-text">Active Roster Ready</span>
              </span>
            </div>
          </div>

          <!-- Section 1: Course & Lecture Selection (Primary Action) -->
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 12px; margin-bottom: 12px;">
            
            <!-- Subject Dropdown -->
            <div class="form-group mb-0">
              <label class="form-label" style="font-size: 0.76rem; font-weight: 700; color: #1e293b; margin-bottom: 6px; display: flex; align-items: center; gap: 5px;">
                <i data-lucide="book-open" style="width: 14px; height: 14px; color: #6366f1;"></i>
                <span>Target Class / Subject *</span>
              </label>
              <select id="multi-class-select" class="form-select text-xs" style="font-weight: 600; border-radius: 10px; border-color: #cbd5e1; height: 42px; background-color: #f8fafc;" required onchange="CaptureView.onCourseChange()">
                <option value="">Loading active subjects...</option>
              </select>
            </div>

            <!-- Lecture Topic Input -->
            <div class="form-group mb-0">
              <label class="form-label" style="font-size: 0.76rem; font-weight: 700; color: #1e293b; margin-bottom: 6px; display: flex; align-items: center; gap: 5px;">
                <i data-lucide="file-text" style="width: 14px; height: 14px; color: #6366f1;"></i>
                <span>Lecture Title / Topic *</span>
              </label>
              <input type="text" id="multi-session-name" class="form-input text-xs" style="font-weight: 600; border-radius: 10px; border-color: #cbd5e1; height: 42px; background-color: #f8fafc;" placeholder="e.g. Regular Lecture" value="Regular Lecture" required oninput="CaptureView.updateAttendanceContextPreview()" />
            </div>

          </div>

          <!-- Custom Course Details Box (Visible ONLY when Course == OTHER) -->
          <div id="custom-course-wrapper" class="hidden p-3.5 bg-amber-50/80 border border-amber-200 rounded-xl space-y-2 mb-3">
            <div class="flex items-center gap-2 text-xs text-amber-900 font-semibold">
              <i data-lucide="alert-triangle" class="w-4 h-4 text-amber-600 flex-shrink-0"></i>
              <span>Custom courses are not linked to an existing course roster unless a matching course offering exists.</span>
            </div>
            <div style="display: grid; grid-template-columns: 1fr 2fr; gap: 10px;">
              <div>
                <label class="form-label text-[11px] font-semibold text-slate-700">Custom Course Code *</label>
                <input type="text" id="custom-course-code-input" class="form-input text-xs font-mono font-bold" placeholder="e.g. AI-SPECIAL-01" oninput="CaptureView.onCustomFieldInput()" />
              </div>
              <div>
                <label class="form-label text-[11px] font-semibold text-slate-700">Custom Course Title *</label>
                <input type="text" id="custom-course-title-input" class="form-input text-xs font-semibold" placeholder="e.g. Advanced Workshop" oninput="CaptureView.onCustomFieldInput()" />
              </div>
            </div>
          </div>

          <!-- Advanced Hierarchy Scope Toggle Bar -->
          <div style="display: flex; align-items: center; justify-content: flex-end; margin-bottom: 12px;">
            <button type="button" class="btn-secondary text-[11px] py-1.5 px-3" style="border-radius: 8px; font-weight: 700; display: inline-flex; align-items: center; gap: 6px;" onclick="CaptureView.toggleAdvancedHierarchy()">
              <i data-lucide="sliders-horizontal" class="w-3.5 h-3.5 text-indigo-600"></i>
              <span>Filter Department & Divisions</span>
              <i data-lucide="chevron-down" id="hierarchy-toggle-icon" class="w-3.5 h-3.5 text-slate-400 transition-transform"></i>
            </button>
          </div>

          <!-- Collapsible Section: Academic Hierarchy Context -->
          <div id="advanced-hierarchy-section" class="hidden p-3.5 bg-slate-50/90 border border-dashed border-slate-200 rounded-xl mb-4">
            <div class="config-section-tag" style="margin-bottom: 8px;">
              <span class="step-num">⚙️</span>
              <span>Advanced Cross-Program & Division Scope</span>
            </div>

            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px;">
              
              <!-- 1. Department -->
              <div class="form-group mb-0">
                <label class="form-label" style="font-size: 0.72rem; font-weight: 700; color: #334155; margin-bottom: 4px; display: flex; align-items: center; gap: 5px;">
                  <i data-lucide="building-2" style="width: 13px; height: 13px; color: #6366f1;"></i>
                  <span>Department</span>
                </label>
                <select id="multi-dept-select" class="form-select text-xs" style="font-weight: 600; border-radius: 8px; border-color: #cbd5e1; height: 38px; background-color: #ffffff;" onchange="CaptureView.onDeptChange()">
                  <option value="ALL">All Departments</option>
                  <option value="Computer" selected>Computer</option>
                  <option value="Law">Law</option>
                  <option value="Management">Management</option>
                  <option value="Sport">Sport</option>
                  <option value="OTHER">Other...</option>
                </select>
                <div id="custom-dept-wrapper" class="hidden mt-2">
                  <input type="text" id="custom-dept-input" class="form-input text-xs" placeholder="Custom Department" oninput="CaptureView.onCustomFieldInput()" />
                </div>
              </div>

              <!-- 2. Program / Degree -->
              <div class="form-group mb-0">
                <label class="form-label" style="font-size: 0.72rem; font-weight: 700; color: #334155; margin-bottom: 4px; display: flex; align-items: center; gap: 5px;">
                  <i data-lucide="graduation-cap" style="width: 13px; height: 13px; color: #6366f1;"></i>
                  <span>Program / Degree</span>
                </label>
                <div class="multi-select-container" id="program-multi-select-container" style="position: relative;">
                  <div class="multi-select-box" id="program-trigger-box" style="min-height: 38px; border-radius: 8px; border-color: #cbd5e1; background-color: #ffffff;" onclick="CaptureView.toggleProgramDropdown()">
                    <div class="multi-select-chips" id="program-selected-chips"></div>
                    <i data-lucide="chevron-down" class="w-3 h-3 text-slate-400 flex-shrink-0"></i>
                  </div>
                  <div class="multi-select-dropdown hidden" id="program-dropdown-menu">
                    <div id="program-items-list" class="space-y-1"></div>
                    <div class="multi-select-actions">
                      <button type="button" class="btn-secondary text-[11px] py-1 px-2" onclick="event.stopPropagation(); CaptureView.selectAllPrograms()">Select All</button>
                      <button type="button" class="btn-secondary text-[11px] py-1 px-2 text-rose-600" onclick="event.stopPropagation(); CaptureView.clearAllPrograms()">Clear</button>
                    </div>
                  </div>
                </div>
                <div id="custom-prog-wrapper" class="hidden mt-2">
                  <input type="text" id="custom-prog-input" class="form-input text-xs" placeholder="Custom Program" oninput="CaptureView.onCustomFieldInput()" />
                </div>
              </div>

              <!-- 3. Semester -->
              <div class="form-group mb-0">
                <label class="form-label" style="font-size: 0.72rem; font-weight: 700; color: #334155; margin-bottom: 4px; display: flex; align-items: center; gap: 5px;">
                  <i data-lucide="calendar" style="width: 13px; height: 13px; color: #6366f1;"></i>
                  <span>Semester</span>
                </label>
                <div class="multi-select-container" id="semester-multi-select-container" style="position: relative;">
                  <div class="multi-select-box" id="semester-trigger-box" style="min-height: 38px; border-radius: 8px; border-color: #cbd5e1; background-color: #ffffff;" onclick="CaptureView.toggleSemesterDropdown()">
                    <div class="multi-select-chips" id="semester-selected-chips"></div>
                    <i data-lucide="chevron-down" class="w-3 h-3 text-slate-400 flex-shrink-0"></i>
                  </div>
                  <div class="multi-select-dropdown hidden" id="semester-dropdown-menu">
                    <div id="semester-items-list" class="space-y-1"></div>
                    <div class="multi-select-actions">
                      <button type="button" class="btn-secondary text-[11px] py-1 px-2" onclick="event.stopPropagation(); CaptureView.selectAllSemesters()">Select All</button>
                      <button type="button" class="btn-secondary text-[11px] py-1 px-2 text-rose-600" onclick="event.stopPropagation(); CaptureView.clearAllSemesters()">Clear</button>
                    </div>
                  </div>
                </div>
                <div id="custom-sem-wrapper" class="hidden mt-2">
                  <input type="text" id="custom-sem-input" class="form-input text-xs" placeholder="Custom Semester" oninput="CaptureView.onCustomFieldInput()" />
                </div>
              </div>

              <!-- 4. Division / Section -->
              <div class="form-group mb-0">
                <label class="form-label" style="font-size: 0.72rem; font-weight: 700; color: #334155; margin-bottom: 4px; display: flex; align-items: center; gap: 5px;">
                  <i data-lucide="users" style="width: 13px; height: 13px; color: #6366f1;"></i>
                  <span>Division / Section</span>
                </label>
                <div class="multi-select-container" id="division-multi-select-container" style="position: relative;">
                  <div class="multi-select-box" id="division-trigger-box" style="min-height: 38px; border-radius: 8px; border-color: #cbd5e1; background-color: #ffffff;" onclick="CaptureView.toggleDivisionDropdown()">
                    <div class="multi-select-chips" id="division-selected-chips"></div>
                    <i data-lucide="chevron-down" class="w-3 h-3 text-slate-400 flex-shrink-0"></i>
                  </div>
                  <div class="multi-select-dropdown hidden" id="division-dropdown-menu">
                    <div id="division-items-list" class="space-y-1"></div>
                    <div class="multi-select-actions">
                      <button type="button" class="btn-secondary text-[11px] py-1 px-2" onclick="event.stopPropagation(); CaptureView.selectAllDivisions()">Select All</button>
                      <button type="button" class="btn-secondary text-[11px] py-1 px-2 text-rose-600" onclick="event.stopPropagation(); CaptureView.clearAllDivisions()">Clear</button>
                    </div>
                  </div>
                </div>
                <div id="custom-div-wrapper" class="hidden mt-2">
                  <input type="text" id="custom-div-input" class="form-input text-xs" placeholder="Custom Division" oninput="CaptureView.onCustomFieldInput()" />
                </div>
              </div>

            </div>
          </div>

          <!-- Section 2: Method Selector Tabs - Segmented Pill -->
          <div style="border-top: 1px solid #f1f5f9; padding-top: 14px;">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; flex-wrap: wrap; gap: 8px;">
              <label class="form-label" style="font-size: 0.75rem; font-weight: 800; color: #334155; margin-bottom: 0; text-transform: uppercase; letter-spacing: 0.04em;">Classroom Ingestion Mode</label>
            </div>
            
            <div class="ingest-method-nav">
              <button type="button" id="tab-upload-btn" class="ingest-method-btn active" onclick="CaptureView.setSourceMode('upload')">
                <i data-lucide="upload-cloud" class="w-4 h-4 text-indigo-600"></i>
                <span>Upload Photos</span>
                <span class="badge desktop-badge" style="background: rgba(99, 102, 241, 0.12); color: #4f46e5; font-size: 0.65rem; font-weight: 800; padding: 2px 6px; border-radius: 6px; margin-left: 4px;">1–8 ANGLES</span>
              </button>
              <button type="button" id="tab-camera-btn" class="ingest-method-btn" onclick="CaptureView.setSourceMode('camera')">
                <i data-lucide="camera" class="w-4 h-4"></i>
                <span>Live Camera</span>
              </button>
            </div>
          </div>
                <span class="badge" style="background: rgba(16, 185, 129, 0.12); color: #059669; font-size: 0.65rem; font-weight: 800; padding: 2px 6px; border-radius: 6px; margin-left: 4px;">REAL-TIME</span>
              </button>
            </div>
          </div>
        </div>

        <!-- Split Workspace Grid: Camera / Preview (Left) + Live Summary (Right) -->
        <div class="capture-workspace-grid">
          
          <!-- LEFT: Bounded Camera Viewport & Ingestion Area -->
          <div class="camera-viewport-card">
            
            <!-- Source 1: Upload Dropzone Box (Default) -->
            <div id="src-upload-box">
              <div class="upload-dropzone" onclick="document.getElementById('multi-file-input').click()">
                <input type="file" id="multi-file-input" accept="image/*" multiple class="hidden" onchange="CaptureView.onFilesSelected(this)" />
                <div id="upload-prompt-text" class="py-4">
                  <div style="width: 54px; height: 54px; border-radius: 16px; background: linear-gradient(135deg, #eef2ff 0%, #e0e7ff 100%); border: 1px solid #c7d2fe; display: flex; align-items: center; justify-content: center; color: #4f46e5; margin: 0 auto 12px; box-shadow: 0 4px 12px rgba(99, 102, 241, 0.15);">
                    <i data-lucide="camera" style="width: 26px; height: 26px;"></i>
                  </div>
                  <h4 style="font-size: 0.95rem; font-weight: 800; color: #0f172a; margin-bottom: 4px;">Capture or Drop Classroom Photos</h4>
                  <p style="font-size: 0.74rem; color: #64748b; margin-bottom: 14px;">Select 1 to 8 panoramic classroom angles (Left, Center, Right, Wide, Back, etc.)</p>
                  
                  <!-- Visual Angle Indicators -->
                  <div style="display: flex; align-items: center; justify-content: center; gap: 8px; flex-wrap: wrap; margin-bottom: 16px;">
                    <span style="font-size: 0.68rem; font-weight: 700; background: #ffffff; color: #475569; padding: 4px 10px; border-radius: 8px; border: 1px solid #e2e8f0; box-shadow: 0 1px 2px rgba(0,0,0,0.04);">📐 Left Wing</span>
                    <span style="font-size: 0.68rem; font-weight: 700; background: #ffffff; color: #475569; padding: 4px 10px; border-radius: 8px; border: 1px solid #e2e8f0; box-shadow: 0 1px 2px rgba(0,0,0,0.04);">🎯 Center Hall</span>
                    <span style="font-size: 0.68rem; font-weight: 700; background: #ffffff; color: #475569; padding: 4px 10px; border-radius: 8px; border: 1px solid #e2e8f0; box-shadow: 0 1px 2px rgba(0,0,0,0.04);">📐 Right Wing</span>
                    <span style="font-size: 0.68rem; font-weight: 700; background: #ffffff; color: #475569; padding: 4px 10px; border-radius: 8px; border: 1px solid #e2e8f0; box-shadow: 0 1px 2px rgba(0,0,0,0.04);">🔍 Back Rows</span>
                  </div>

                  <button type="button" class="btn-secondary text-xs font-bold py-2 px-5" style="border-radius: 10px; background: #ffffff; border-color: rgba(99, 102, 241, 0.3); color: #4f46e5; box-shadow: 0 2px 6px rgba(0,0,0,0.04);">
                    <i data-lucide="folder-open" class="w-3.5 h-3.5 mr-1.5"></i> Browse Photos / Take Snap
                  </button>
                </div>
              </div>
              <div id="upload-preview-strip" class="multi-snap-strip hidden"></div>
            </div>

            <!-- Source 2: Live Camera Viewport Box -->
            <div id="src-camera-box" class="hidden">
              <div class="camera-feed-container">
                <video id="multi-webcam-video" autoplay playsinline></video>
                <div class="camera-status-overlay">
                  <span class="camera-status-dot scanning" id="cam-status-dot"></span>
                  <span id="cam-status-text">Camera Active</span>
                </div>
                <div class="camera-count-overlay">
                  <span id="cam-snap-counter" class="font-mono text-emerald-400">0 Angles Snapped</span>
                </div>
                <!-- Touch-friendly Floating Camera Flip Button -->
                <button type="button" class="camera-flip-overlay-btn" id="cam-flip-overlay-btn" onclick="CaptureView.switchCamera()" title="Switch Front / Back Camera" aria-label="Switch Camera">
                  <i data-lucide="switch-camera" class="w-4 h-4"></i>
                </button>
              </div>

              <!-- Controls bar below webcam -->
              <div class="camera-controls-bar">
                <div class="flex items-center gap-2 flex-wrap">
                  <button type="button" class="btn-primary btn-sm" onclick="CaptureView.takeClassroomSnap()">
                    <i data-lucide="camera" class="w-3.5 h-3.5"></i>
                    <span>Snap Angle</span>
                  </button>
                  <button type="button" class="btn-secondary btn-sm" onclick="CaptureView.switchCamera()" id="cam-facing-btn" title="Switch Front / Back Camera">
                    <i data-lucide="switch-camera" class="w-3.5 h-3.5 text-indigo-600"></i>
                    <span id="cam-facing-label">Back Cam</span>
                  </button>
                  <button type="button" class="btn-secondary btn-sm" onclick="CaptureView.startCamera()" title="Restart Camera Stream">
                    <i data-lucide="refresh-cw" class="w-3.5 h-3.5"></i>
                    <span>Restart</span>
                  </button>
                </div>
                <span class="text-[11px] text-slate-500 font-medium">Snap 1 to 8 angles across the lecture hall</span>
              </div>

              <div id="cam-snap-strip" class="multi-snap-strip"></div>
            </div>

            <!-- Execution CTA Bar -->
            <div class="flex items-center justify-between pt-4 border-t border-slate-100 mt-4 flex-wrap gap-3">
              <div class="flex items-center gap-2">
                <div style="width: 7px; height: 7px; border-radius: 50%; background: #6366f1;"></div>
                <span class="text-xs text-slate-500 font-semibold">Ready for YOLO detection & ArcFace embedding</span>
              </div>
              <button type="submit" class="btn-primary text-xs py-2.5 px-6 font-bold" id="multi-scan-btn" style="border-radius: 10px; background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%); box-shadow: 0 4px 14px rgba(99, 102, 241, 0.35); display: inline-flex; align-items: center; gap: 8px;">
                <i data-lucide="scan" class="w-4 h-4"></i>
                <span>Scan & Process Biometric Attendance</span>
              </button>
            </div>
          </div>

          <!-- RIGHT: Live Attendance Summary & Telemetry Panel -->
          <div class="live-summary-card">
            <div>
              <div class="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
                <div class="flex items-center gap-2">
                  <i data-lucide="activity" style="width: 15px; height: 15px; color: #6366f1;"></i>
                  <span class="text-xs font-extrabold text-slate-900 uppercase tracking-wider">Attendance Telemetry</span>
                </div>
                <span class="badge badge-neutral text-[10px] font-bold px-2.5 py-0.5" id="session-telemetry-badge">Standby</span>
              </div>

              <!-- Colored Mini KPI Cards Grid -->
              <div class="kpi-mini-grid mb-4">
                
                <!-- Detected -->
                <div class="kpi-mini-box box-detected">
                  <span class="kpi-mini-label text-indigo-700">
                    <span>Detected</span>
                    <i data-lucide="scan-face" class="w-3.5 h-3.5 opacity-70"></i>
                  </span>
                  <span class="kpi-mini-val text-indigo-950" id="kpi-detected-val">-</span>
                </div>

                <!-- Present -->
                <div class="kpi-mini-box box-present">
                  <span class="kpi-mini-label text-emerald-700">
                    <span>Present</span>
                    <i data-lucide="check-circle" class="w-3.5 h-3.5 opacity-70"></i>
                  </span>
                  <span class="kpi-mini-val text-emerald-950" id="kpi-present-val">-</span>
                </div>

                <!-- Absent -->
                <div class="kpi-mini-box box-absent">
                  <span class="kpi-mini-label text-rose-700">
                    <span>Absent</span>
                    <i data-lucide="user-x" class="w-3.5 h-3.5 opacity-70"></i>
                  </span>
                  <span class="kpi-mini-val text-rose-950" id="kpi-absent-val">-</span>
                </div>

                <!-- Unknown -->
                <div class="kpi-mini-box box-unknown">
                  <span class="kpi-mini-label text-amber-700">
                    <span>Review</span>
                    <i data-lucide="help-circle" class="w-3.5 h-3.5 opacity-70"></i>
                  </span>
                  <span class="kpi-mini-val text-amber-950" id="kpi-unknown-val">-</span>
                </div>

              </div>
            </div>
          </div>

        </div>
      </form>

      <!-- Results Workspace (Appears after scanning) -->
      <div id="multi-attendance-results" class="hidden"></div>`;

    // Global click listener to close dropdown on click outside
    document.addEventListener("click", (e) => {
      const pContainer = document.getElementById("program-multi-select-container");
      if (pContainer && !pContainer.contains(e.target)) {
        CaptureView.toggleProgramDropdown(false);
      }
      const sContainer = document.getElementById("semester-multi-select-container");
      if (sContainer && !sContainer.contains(e.target)) {
        CaptureView.toggleSemesterDropdown(false);
      }
      const dContainer = document.getElementById("division-multi-select-container");
      if (dContainer && !dContainer.contains(e.target)) {
        CaptureView.toggleDivisionDropdown(false);
      }
    });

    await this.loadCourses();
    this.setupForm();
    if (window.lucide) window.lucide.createIcons();
  },

  async loadCourses() {
    const select = document.getElementById("multi-class-select");
    if (!select) return;

    try {
      const [meta, classes, sensitivityConfig] = await Promise.all([
        API.get("/academic/metadata").catch(() => null),
        API.get("/classes").catch(() => []),
        API.get("/admin/system-settings/matching-sensitivity").catch(() => null)
      ]);

      if (sensitivityConfig) {
        this.institutionalTolerance = parseFloat(sensitivityConfig.tolerance || 0.50);
        this.institutionalToleranceLabel = sensitivityConfig.label || "Standard Balanced (0.50)";
        const elSens = document.getElementById("capture-locked-sensitivity-text");
        if (elSens) elSens.textContent = `${this.institutionalToleranceLabel}`;
      }

      this.cachedMeta = meta;

      if (meta) {
        const dSel = document.getElementById("multi-dept-select");
        if (dSel && meta.departments && meta.departments.length > 0) {
          const depts = [...meta.departments];
          const currVal = dSel.value || "Computer Science & Engineering";
          dSel.innerHTML = `
            <option value="ALL" ${currVal === 'ALL' ? 'selected' : ''}>All Departments</option>
            ${depts.map(d => `<option value="${d}" ${d === currVal || (!currVal && d.toLowerCase().includes('computer')) ? 'selected' : ''}>${d}</option>`).join("")}
            <option value="OTHER" ${currVal === 'OTHER' ? 'selected' : ''}>Other...</option>
          `;
        }

        if (meta.programs && meta.programs.length > 0) {
          this.availablePrograms = [...meta.programs];
        }

        if (meta.semesters && meta.semesters.length > 0) {
          this.availableSemesters = [...meta.semesters];
        }

        if (meta.divisions && meta.divisions.length > 0) {
          this.availableDivisions = [...meta.divisions];
        }
      }

      let allLoadedClasses = classes || [];

      // RBAC Check: If Faculty member (teacher), restrict to assigned courses only
      const user = Auth.currentUser;
      if (user && user.role === "teacher") {
        allLoadedClasses = allLoadedClasses.filter(c => 
          c.teacher_id === user.id || 
          (c.teachers && c.teachers.some(t => t.id === user.id))
        );
      }

      this.allClasses = allLoadedClasses;
      this.updateAvailableDivisions();

    } catch (e) {
      if (select) select.innerHTML = `<option value="">Select Course</option><option value="OTHER">Other (Custom Course)...</option>`;
      this.updateAttendanceContextPreview();
    }
  },

  updateAvailableDivisions() {
    const deptSel = document.getElementById("multi-dept-select")?.value || "";
    const customDept = document.getElementById("custom-dept-input")?.value?.trim() || "";
    const deptVal = (deptSel === "OTHER" ? customDept : deptSel).toLowerCase();

    const selectedProgs = Array.from(this.selectedPrograms).map(p => p.toLowerCase());
    const selectedSems = Array.from(this.selectedSemesters).map(s => s.toLowerCase());

    // Find divisions that exist for this academic context in allClasses
    const matching = this.allClasses.filter(c => {
      const matchDept = !deptVal || (c.department && c.department.toLowerCase().includes(deptVal)) || (deptVal.includes(c.department?.toLowerCase() || ""));
      const matchProg = selectedProgs.length === 0 || (c.program && selectedProgs.includes(c.program.toLowerCase()));
      const matchSem = selectedSems.length === 0 || (c.semester && (selectedSems.includes(c.semester.toLowerCase()) || selectedSems.some(s => c.semester.toLowerCase().includes(s.replace('semester', '').trim()))));
      return matchDept && matchProg && matchSem;
    });

    const foundDivisions = new Set();
    matching.forEach(c => {
      if (c.section) foundDivisions.add(c.section);
    });

    // If metadata divisions available, also include them
    const metaDivs = this.cachedMeta?.divisions || ["A", "B", "C", "D"];
    metaDivs.forEach(d => foundDivisions.add(d));

    this.availableDivisions = Array.from(foundDivisions).sort();

    // Render all 3 Multi-Select Boxes (No forced defaults)
    this.renderProgramMultiSelect();
    this.renderSemesterMultiSelect();
    this.renderDivisionMultiSelect();
    this.populateCourseDropdown();
  },

  // ================= 1. Program Multi-Select =================
  renderProgramMultiSelect() {
    const chipsContainer = document.getElementById("program-selected-chips");
    const itemsList = document.getElementById("program-items-list");
    if (!chipsContainer || !itemsList) return;

    const selectedArray = Array.from(this.selectedPrograms).sort();
    const customProgVal = document.getElementById("custom-prog-input")?.value?.trim();

    let chipsHtml = "";
    if (selectedArray.length === 0 && !this.hasOtherProgram) {
      chipsHtml = `<span class="multi-select-placeholder">Select Program(s)...</span>`;
    } else if (selectedArray.length + (this.hasOtherProgram ? 1 : 0) > 2) {
      chipsHtml = `<span class="multi-select-chip font-bold">${selectedArray.length + (this.hasOtherProgram ? 1 : 0)} Programs Selected</span>`;
    } else {
      chipsHtml = selectedArray.map(prog => `
        <span class="multi-select-chip">
          ${prog}
          <span class="multi-select-chip-remove" onclick="event.stopPropagation(); CaptureView.toggleProgram('${prog}')">&times;</span>
        </span>
      `).join("");

      if (this.hasOtherProgram) {
        chipsHtml += `
          <span class="multi-select-chip bg-amber-50 text-amber-800 border-amber-300">
            ${customProgVal || 'Custom Prog'}
            <span class="multi-select-chip-remove" onclick="event.stopPropagation(); CaptureView.toggleOtherProgram(false)">&times;</span>
          </span>
        `;
      }
    }
    chipsContainer.innerHTML = chipsHtml;

    itemsList.innerHTML = `
      ${this.availablePrograms.map(prog => {
        const isChecked = this.selectedPrograms.has(prog);
        return `
          <div class="multi-select-item ${isChecked ? 'selected' : ''}" onclick="CaptureView.toggleProgram('${prog}')">
            <input type="checkbox" ${isChecked ? 'checked' : ''} onclick="event.stopPropagation(); CaptureView.toggleProgram('${prog}')" />
            <span>${prog}</span>
          </div>
        `;
      }).join("")}

      <div class="multi-select-item ${this.hasOtherProgram ? 'selected' : ''}" onclick="CaptureView.toggleOtherProgram()">
        <input type="checkbox" ${this.hasOtherProgram ? 'checked' : ''} onclick="event.stopPropagation(); CaptureView.toggleOtherProgram()" />
        <span class="font-semibold text-indigo-600">Other (Custom Program)...</span>
      </div>
    `;

    const customProgWrapper = document.getElementById("custom-prog-wrapper");
    if (this.hasOtherProgram) {
      customProgWrapper?.classList.remove("hidden");
    } else {
      customProgWrapper?.classList.add("hidden");
      const customInput = document.getElementById("custom-prog-input");
      if (customInput) customInput.value = "";
    }
  },

  toggleProgramDropdown(forceState) {
    const menu = document.getElementById("program-dropdown-menu");
    const box = document.getElementById("program-trigger-box");
    if (!menu || !box) return;

    if (forceState !== undefined) {
      this.isProgramDropdownOpen = forceState;
    } else {
      this.isProgramDropdownOpen = !this.isProgramDropdownOpen;
    }

    menu.classList.toggle("hidden", !this.isProgramDropdownOpen);
    box.classList.toggle("active", this.isProgramDropdownOpen);
  },

  toggleProgram(prog) {
    if (this.selectedPrograms.has(prog)) {
      this.selectedPrograms.delete(prog);
    } else {
      this.selectedPrograms.add(prog);
    }
    this.renderProgramMultiSelect();
    this.updateAvailableDivisions();
  },

  toggleOtherProgram(forceState) {
    if (forceState !== undefined) {
      this.hasOtherProgram = forceState;
    } else {
      this.hasOtherProgram = !this.hasOtherProgram;
    }
    this.renderProgramMultiSelect();
    this.updateAvailableDivisions();
    if (this.hasOtherProgram) {
      document.getElementById("custom-prog-input")?.focus();
    }
  },

  selectAllPrograms() {
    this.availablePrograms.forEach(p => this.selectedPrograms.add(p));
    this.renderProgramMultiSelect();
    this.updateAvailableDivisions();
  },

  clearAllPrograms() {
    this.selectedPrograms.clear();
    this.hasOtherProgram = false;
    this.renderProgramMultiSelect();
    this.updateAvailableDivisions();
  },

  // ================= 2. Semester Multi-Select =================
  renderSemesterMultiSelect() {
    const chipsContainer = document.getElementById("semester-selected-chips");
    const itemsList = document.getElementById("semester-items-list");
    if (!chipsContainer || !itemsList) return;

    const selectedArray = Array.from(this.selectedSemesters).sort();
    const customSemVal = document.getElementById("custom-sem-input")?.value?.trim();

    let chipsHtml = "";
    if (selectedArray.length === 0 && !this.hasOtherSemester) {
      chipsHtml = `<span class="multi-select-placeholder">Select Semester(s)...</span>`;
    } else if (selectedArray.length + (this.hasOtherSemester ? 1 : 0) > 2) {
      chipsHtml = `<span class="multi-select-chip font-bold">${selectedArray.length + (this.hasOtherSemester ? 1 : 0)} Semesters Selected</span>`;
    } else {
      chipsHtml = selectedArray.map(sem => `
        <span class="multi-select-chip">
          ${sem}
          <span class="multi-select-chip-remove" onclick="event.stopPropagation(); CaptureView.toggleSemester('${sem}')">&times;</span>
        </span>
      `).join("");

      if (this.hasOtherSemester) {
        chipsHtml += `
          <span class="multi-select-chip bg-amber-50 text-amber-800 border-amber-300">
            ${customSemVal || 'Custom Sem'}
            <span class="multi-select-chip-remove" onclick="event.stopPropagation(); CaptureView.toggleOtherSemester(false)">&times;</span>
          </span>
        `;
      }
    }
    chipsContainer.innerHTML = chipsHtml;

    itemsList.innerHTML = `
      ${this.availableSemesters.map(sem => {
        const isChecked = this.selectedSemesters.has(sem);
        return `
          <div class="multi-select-item ${isChecked ? 'selected' : ''}" onclick="CaptureView.toggleSemester('${sem}')">
            <input type="checkbox" ${isChecked ? 'checked' : ''} onclick="event.stopPropagation(); CaptureView.toggleSemester('${sem}')" />
            <span>${sem}</span>
          </div>
        `;
      }).join("")}

      <div class="multi-select-item ${this.hasOtherSemester ? 'selected' : ''}" onclick="CaptureView.toggleOtherSemester()">
        <input type="checkbox" ${this.hasOtherSemester ? 'checked' : ''} onclick="event.stopPropagation(); CaptureView.toggleOtherSemester()" />
        <span class="font-semibold text-indigo-600">Other (Custom Semester)...</span>
      </div>
    `;

    const customSemWrapper = document.getElementById("custom-sem-wrapper");
    if (this.hasOtherSemester) {
      customSemWrapper?.classList.remove("hidden");
    } else {
      customSemWrapper?.classList.add("hidden");
      const customInput = document.getElementById("custom-sem-input");
      if (customInput) customInput.value = "";
    }
  },

  toggleSemesterDropdown(forceState) {
    const menu = document.getElementById("semester-dropdown-menu");
    const box = document.getElementById("semester-trigger-box");
    if (!menu || !box) return;

    if (forceState !== undefined) {
      this.isSemesterDropdownOpen = forceState;
    } else {
      this.isSemesterDropdownOpen = !this.isSemesterDropdownOpen;
    }

    menu.classList.toggle("hidden", !this.isSemesterDropdownOpen);
    box.classList.toggle("active", this.isSemesterDropdownOpen);
  },

  toggleSemester(sem) {
    if (this.selectedSemesters.has(sem)) {
      this.selectedSemesters.delete(sem);
    } else {
      this.selectedSemesters.add(sem);
    }
    this.renderSemesterMultiSelect();
    this.updateAvailableDivisions();
  },

  toggleOtherSemester(forceState) {
    if (forceState !== undefined) {
      this.hasOtherSemester = forceState;
    } else {
      this.hasOtherSemester = !this.hasOtherSemester;
    }
    this.renderSemesterMultiSelect();
    this.updateAvailableDivisions();
    if (this.hasOtherSemester) {
      document.getElementById("custom-sem-input")?.focus();
    }
  },

  selectAllSemesters() {
    this.availableSemesters.forEach(s => this.selectedSemesters.add(s));
    this.renderSemesterMultiSelect();
    this.updateAvailableDivisions();
  },

  clearAllSemesters() {
    this.selectedSemesters.clear();
    this.hasOtherSemester = false;
    this.renderSemesterMultiSelect();
    this.updateAvailableDivisions();
  },

  // ================= 3. Division Multi-Select =================
  renderDivisionMultiSelect() {
    const chipsContainer = document.getElementById("division-selected-chips");
    const itemsList = document.getElementById("division-items-list");
    if (!chipsContainer || !itemsList) return;

    // 1. Render Chips
    const selectedArray = Array.from(this.selectedDivisions).sort();
    const customDivVal = document.getElementById("custom-div-input")?.value?.trim();
    
    let chipsHtml = "";
    if (selectedArray.length === 0 && !this.hasOtherDivision) {
      chipsHtml = `<span class="multi-select-placeholder">Select Division(s)...</span>`;
    } else if (selectedArray.length + (this.hasOtherDivision ? 1 : 0) > 3) {
      chipsHtml = `
        <span class="multi-select-chip font-bold">
          ${selectedArray.length + (this.hasOtherDivision ? 1 : 0)} Divisions Selected
        </span>
      `;
    } else {
      chipsHtml = selectedArray.map(div => `
        <span class="multi-select-chip">
          Div ${div}
          <span class="multi-select-chip-remove" onclick="event.stopPropagation(); CaptureView.toggleDivision('${div}')">&times;</span>
        </span>
      `).join("");

      if (this.hasOtherDivision) {
        chipsHtml += `
          <span class="multi-select-chip bg-amber-50 text-amber-800 border-amber-300">
            ${customDivVal || 'Custom Div'}
            <span class="multi-select-chip-remove" onclick="event.stopPropagation(); CaptureView.toggleOtherDivision(false)">&times;</span>
          </span>
        `;
      }
    }
    chipsContainer.innerHTML = chipsHtml;

    // 2. Render Dropdown Items
    itemsList.innerHTML = `
      ${this.availableDivisions.map(div => {
        const isChecked = this.selectedDivisions.has(div);
        return `
          <div class="multi-select-item ${isChecked ? 'selected' : ''}" onclick="CaptureView.toggleDivision('${div}')">
            <input type="checkbox" ${isChecked ? 'checked' : ''} onclick="event.stopPropagation(); CaptureView.toggleDivision('${div}')" />
            <span>Division ${div}</span>
          </div>
        `;
      }).join("")}

      <div class="multi-select-item ${this.hasOtherDivision ? 'selected' : ''}" onclick="CaptureView.toggleOtherDivision()">
        <input type="checkbox" ${this.hasOtherDivision ? 'checked' : ''} onclick="event.stopPropagation(); CaptureView.toggleOtherDivision()" />
        <span class="font-semibold text-indigo-600">Other (Custom Division)...</span>
      </div>
    `;

    // 3. Custom Division Field Toggle
    const customDivWrapper = document.getElementById("custom-div-wrapper");
    if (this.hasOtherDivision) {
      customDivWrapper?.classList.remove("hidden");
    } else {
      customDivWrapper?.classList.add("hidden");
      const customInput = document.getElementById("custom-div-input");
      if (customInput) customInput.value = "";
    }
  },

  toggleDivisionDropdown(forceState) {
    const menu = document.getElementById("division-dropdown-menu");
    const box = document.getElementById("division-trigger-box");
    if (!menu || !box) return;

    if (forceState !== undefined) {
      this.isDivisionDropdownOpen = forceState;
    } else {
      this.isDivisionDropdownOpen = !this.isDivisionDropdownOpen;
    }

    menu.classList.toggle("hidden", !this.isDivisionDropdownOpen);
    box.classList.toggle("active", this.isDivisionDropdownOpen);
  },

  toggleDivision(div) {
    if (this.selectedDivisions.has(div)) {
      this.selectedDivisions.delete(div);
    } else {
      this.selectedDivisions.add(div);
    }

    this.renderDivisionMultiSelect();
    this.populateCourseDropdown();
  },

  toggleOtherDivision(forceState) {
    if (forceState !== undefined) {
      this.hasOtherDivision = forceState;
    } else {
      this.hasOtherDivision = !this.hasOtherDivision;
    }

    this.renderDivisionMultiSelect();
    this.populateCourseDropdown();

    if (this.hasOtherDivision) {
      document.getElementById("custom-div-input")?.focus();
    }
  },

  selectAllDivisions() {
    this.availableDivisions.forEach(d => this.selectedDivisions.add(d));
    this.renderDivisionMultiSelect();
    this.populateCourseDropdown();
  },

  clearAllDivisions() {
    this.selectedDivisions.clear();
    this.hasOtherDivision = false;
    this.renderDivisionMultiSelect();
    this.populateCourseDropdown();
  },

  onDeptChange() {
    const val = document.getElementById("multi-dept-select")?.value;
    const customWrapper = document.getElementById("custom-dept-wrapper");
    const customInput = document.getElementById("custom-dept-input");

    if (val === "OTHER") {
      customWrapper?.classList.remove("hidden");
      customInput?.focus();
    } else {
      customWrapper?.classList.add("hidden");
      if (customInput) customInput.value = "";
    }

    this.updateAvailableDivisions();
  },

  onCustomFieldInput() {
    this.renderProgramMultiSelect();
    this.renderSemesterMultiSelect();
    this.renderDivisionMultiSelect();
    this.populateCourseDropdown(false);
    this.updateAttendanceContextPreview();
  },

  populateCourseDropdown(resetSelection = true) {
    const select = document.getElementById("multi-class-select");
    if (!select || !this.allClasses) return;

    const deptSel = document.getElementById("multi-dept-select")?.value || "";
    const customDept = document.getElementById("custom-dept-input")?.value?.trim() || "";
    const deptVal = (deptSel === "OTHER" ? customDept : (deptSel === "ALL" ? "" : deptSel)).toLowerCase();

    const selectedProgs = Array.from(this.selectedPrograms).map(p => p.toLowerCase());
    const selectedSems = Array.from(this.selectedSemesters).map(s => s.toLowerCase());
    const selectedDivs = Array.from(this.selectedDivisions);

    // Group classes by course code & name for the STRICTLY selected academic context
    const matchingGroups = new Map();

    this.allClasses.forEach(c => {
      // 1. Department match (if not ALL / empty, match department)
      const matchDept = !deptVal || (c.department && c.department.toLowerCase().includes(deptVal)) || (deptVal && deptVal.includes(c.department?.toLowerCase() || ""));

      // 2. Program match (must match one of the selected programs)
      const matchProg = selectedProgs.length === 0 || (c.program && selectedProgs.includes(c.program.toLowerCase()));

      // 3. Semester match (must match one of the selected semesters)
      const matchSem = selectedSems.length === 0 || (c.semester && (
        selectedSems.includes(c.semester.toLowerCase()) || 
        selectedSems.some(s => c.semester.toLowerCase().replace(/\s+/g, '') === s.replace(/\s+/g, ''))
      ));

      // 4. Section / Division match (must match one of the selected divisions if divisions selected)
      const matchDiv = selectedDivs.length === 0 || (c.section && selectedDivs.includes(c.section));

      // STRICT FILTER: A subject MUST match Department, Program, Semester, AND Division
      if (matchDept && matchProg && matchSem && matchDiv) {
        const key = `${c.code}__${c.name}__${c.program || ''}__${c.semester || ''}`;
        if (!matchingGroups.has(key)) {
          matchingGroups.set(key, {
            code: c.code,
            name: c.name,
            program: c.program,
            semester: c.semester,
            department: c.department,
            sections: [],
            matchingClassIds: [],
            totalStudents: 0
          });
        }
        const g = matchingGroups.get(key);
        if (c.section && !g.sections.includes(c.section)) {
          g.sections.push(c.section);
        }
        if (!g.matchingClassIds.includes(c.id)) {
          g.matchingClassIds.push(c.id);
          g.totalStudents += (c.enrolled_students_count || 0);
        }
      }
    });

    const matchingList = Array.from(matchingGroups.values());

    let optionsHtml = "";

    if (matchingList.length > 0) {
      optionsHtml += matchingList.map(g => {
        const sortedSecs = Array.from(new Set(g.sections)).sort().join(", ");
        const primaryId = g.matchingClassIds[0] || 0;
        const allIdsAttr = g.matchingClassIds.join(",");
        return `
          <option value="${primaryId}" data-class-ids="${allIdsAttr}" data-code="${g.code}" data-name="${g.name}" data-dept="${g.department || ''}" data-prog="${g.program || ''}" data-sem="${g.semester || ''}" data-students="${g.totalStudents}" data-sections="${sortedSecs}">
            ${g.name} (${g.code}) [${g.program || ''} • ${g.semester || ''} • Div ${sortedSecs || 'A'}]
          </option>
        `;
      }).join("");
    }

    // Always append Other (Custom Subject)
    optionsHtml += `<option value="OTHER" data-class-ids="" data-code="CUSTOM-01" data-name="Custom Subject" data-students="0">Other (Custom Subject / Topic)...</option>`;
    select.innerHTML = optionsHtml;

    if (resetSelection) {
      if (matchingList.length > 0) {
        select.selectedIndex = 0;
      } else {
        select.value = "OTHER";
      }
    }

    this.onCourseChange();
  },

  onCourseChange() {
    const select = document.getElementById("multi-class-select");
    const sInput = document.getElementById("multi-session-name");
    const customCourseWrapper = document.getElementById("custom-course-wrapper");
    const customCodeInput = document.getElementById("custom-course-code-input");
    const customTitleInput = document.getElementById("custom-course-title-input");

    if (!select) return;

    if (select.value === "OTHER") {
      customCourseWrapper?.classList.remove("hidden");
      if (customCodeInput && !customCodeInput.value) customCodeInput.value = "AI-SPECIAL-01";
      if (customTitleInput && !customTitleInput.value) customTitleInput.value = "Advanced Computer Vision Workshop";
      if (sInput && (!sInput.value || sInput.value.includes("MongoDB") || sInput.value.includes("Deep Learning"))) {
        sInput.value = "Advanced Computer Vision Workshop";
      }
    } else {
      customCourseWrapper?.classList.add("hidden");
      if (customCodeInput) customCodeInput.value = "";
      if (customTitleInput) customTitleInput.value = "";

      const opt = select.selectedOptions[0];
      if (opt && sInput) {
        const name = opt.getAttribute("data-name") || "";
        sInput.value = `${name} - Lecture ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
      }
    }

    this.updateAttendanceContextPreview();
    if (window.lucide) window.lucide.createIcons();
  },

  toggleAdvancedHierarchy() {
    const sec = document.getElementById("advanced-hierarchy-section");
    const icon = document.getElementById("hierarchy-toggle-icon");
    if (!sec) return;
    const isHidden = sec.classList.contains("hidden");
    if (isHidden) {
      sec.classList.remove("hidden");
      if (icon) icon.style.transform = "rotate(180deg)";
    } else {
      sec.classList.add("hidden");
      if (icon) icon.style.transform = "rotate(0deg)";
    }
    if (window.lucide) window.lucide.createIcons();
  },

  updateAttendanceContextPreview() {
    const deptSel = document.getElementById("multi-dept-select")?.value || "";
    const customDept = document.getElementById("custom-dept-input")?.value?.trim() || "";
    const deptDisplay = (deptSel === "OTHER" ? (customDept || "Custom Department") : deptSel);

    // Selected Programs Formatting
    const selectedProgs = Array.from(this.selectedPrograms).sort();
    const customProgVal = document.getElementById("custom-prog-input")?.value?.trim();
    let progDisplay = "";
    if (selectedProgs.length === 0 && !this.hasOtherProgram) {
      progDisplay = "All Programs";
    } else {
      const parts = [...selectedProgs];
      if (this.hasOtherProgram) parts.push(customProgVal || "Custom Prog");
      progDisplay = parts.join(", ");
    }

    // Selected Semesters Formatting
    const selectedSems = Array.from(this.selectedSemesters).sort();
    const customSemVal = document.getElementById("custom-sem-input")?.value?.trim();
    let semDisplay = "";
    if (selectedSems.length === 0 && !this.hasOtherSemester) {
      semDisplay = "All Semesters";
    } else {
      const parts = [...selectedSems];
      if (this.hasOtherSemester) parts.push(customSemVal || "Custom Sem");
      semDisplay = parts.join(", ");
    }

    // Selected Divisions Formatting
    const selectedDivs = Array.from(this.selectedDivisions).sort();
    const customDivVal = document.getElementById("custom-div-input")?.value?.trim();
    
    let divDisplay = "";
    if (selectedDivs.length === 0 && !this.hasOtherDivision) {
      divDisplay = "All Divisions";
    } else {
      const parts = selectedDivs.map(d => `Division ${d}`);
      if (this.hasOtherDivision) {
        parts.push(customDivVal ? `Div ${customDivVal}` : "Custom Div");
      }
      divDisplay = parts.join(", ");
    }

    const courseSel = document.getElementById("multi-class-select");
    const customCode = document.getElementById("custom-course-code-input")?.value?.trim() || "";
    const customTitle = document.getElementById("custom-course-title-input")?.value?.trim() || "";
    const topicVal = document.getElementById("multi-session-name")?.value?.trim() || "Unspecified Lecture Topic";

    let courseDisplay = "";
    let enrolledCount = 0;
    let isRegisteredRoster = false;

    if (!courseSel || courseSel.value === "OTHER") {
      courseDisplay = `${customCode || 'CUSTOM-01'} — ${customTitle || 'Custom Course Topic'}`;
      isRegisteredRoster = false;
      enrolledCount = 0;
    } else {
      const opt = courseSel.selectedOptions[0];
      if (opt) {
        const code = opt.getAttribute("data-code") || "";
        const name = opt.getAttribute("data-name") || "";
        courseDisplay = `${code} — ${name}`;
        enrolledCount = parseInt(opt.getAttribute("data-students") || "0");
        isRegisteredRoster = true;
      }
    }

    const divCount = selectedDivs.length + (this.hasOtherDivision ? 1 : 0);

    // Update Live Roster Indicator in panel header
    const elActiveRoster = document.getElementById("active-roster-text");
    if (elActiveRoster) {
      if (isRegisteredRoster && divCount > 0) {
        elActiveRoster.innerHTML = `${divCount} Div (${divDisplay}) &bull; ${enrolledCount} Enrolled`;
      } else {
        elActiveRoster.textContent = `Custom Academic Scope`;
      }
    }

    // Safe updates for any existing preview elements
    const elDept = document.getElementById("preview-dept-text");
    const elProg = document.getElementById("preview-prog-text");
    const elSem = document.getElementById("preview-sem-text");
    const elDiv = document.getElementById("preview-div-text");
    const elCourse = document.getElementById("preview-course-text");
    const elTopic = document.getElementById("preview-topic-text");
    const elBadge = document.getElementById("preview-roster-status-badge");
    const elCountText = document.getElementById("preview-enrolled-count-text");
    const elIsolation = document.getElementById("preview-isolation-pill");

    if (elDept) elDept.textContent = deptDisplay;
    if (elProg) elProg.textContent = progDisplay;
    if (elSem) elSem.textContent = semDisplay;
    if (elDiv) elDiv.textContent = divDisplay;
    if (elCourse) elCourse.textContent = courseDisplay;
    if (elTopic) elTopic.textContent = topicVal;

    if (elBadge) {
      if (isRegisteredRoster && divCount > 0) {
        elBadge.className = "badge text-[11px] font-bold px-2.5 py-0.5 bg-emerald-950 text-emerald-300 border border-emerald-700";
        elBadge.textContent = "Registered Roster Active";
      } else {
        elBadge.className = "badge text-[11px] font-bold px-2.5 py-0.5 bg-amber-950 text-amber-300 border border-amber-700";
        elBadge.textContent = "Custom Academic Context";
      }
    }

    if (elCountText) {
      if (isRegisteredRoster && divCount > 0) {
        elCountText.innerHTML = `✓ <b>${divCount}</b> Division${divCount > 1 ? 's' : ''} Selected &bull; <b>${enrolledCount}</b> Students in Selected Rosters`;
      } else {
        elCountText.innerHTML = `⚠ No registered roster associated &bull; Open Evaluation`;
      }
    }

    if (elIsolation) {
      if (isRegisteredRoster) {
        elIsolation.textContent = "Division Isolation Active";
        elIsolation.className = "text-[10px] font-mono bg-slate-800 text-slate-300 px-2.5 py-1 rounded-md border border-slate-700";
      } else {
        elIsolation.textContent = "Ad-Hoc Session";
        elIsolation.className = "text-[10px] font-mono bg-amber-950/80 text-amber-300 px-2.5 py-1 rounded-md border border-amber-800";
      }
    }
  },

  setSourceMode(mode) {
    this.activeMode = mode;
    document.querySelectorAll("#tab-upload-btn, #tab-camera-btn").forEach(b => b.classList.remove("active"));
    
    const uploadBox = document.getElementById("src-upload-box");
    const cameraBox = document.getElementById("src-camera-box");
    if (uploadBox) uploadBox.classList.add("hidden");
    if (cameraBox) cameraBox.classList.add("hidden");

    if (mode === "upload") {
      document.getElementById("tab-upload-btn")?.classList.add("active");
      uploadBox?.classList.remove("hidden");
      this.stopCamera();
    } else if (mode === "camera") {
      document.getElementById("tab-camera-btn")?.classList.add("active");
      cameraBox?.classList.remove("hidden");
      this.startCamera();
    }
  },

  currentFacingMode: "environment",

  async switchCamera() {
    this.currentFacingMode = (this.currentFacingMode === "environment") ? "user" : "environment";
    const label = document.getElementById("cam-facing-label");
    if (label) {
      label.textContent = (this.currentFacingMode === "environment") ? "Back Cam" : "Front Cam";
    }
    const flipBtn = document.getElementById("cam-flip-overlay-btn");
    if (flipBtn) {
      flipBtn.style.transform = "rotate(180deg)";
      setTimeout(() => { if (flipBtn) flipBtn.style.transform = ""; }, 300);
    }
    await this.startCamera();
    if (window.App && typeof window.App.showToast === 'function') {
      window.App.showToast(`Camera switched to: ${this.currentFacingMode === "environment" ? "Back Camera" : "Front Camera (Selfie)"}`, "info");
    }
  },

  async startCamera() {
    const video = document.getElementById("multi-webcam-video");
    if (!video) return;
    
    // Stop any existing stream first
    this.stopCamera();

    // Check if mediaDevices is supported in this browser context (requires HTTPS or localhost on mobile)
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      App.showToast("Mobile browsers require HTTPS for live video streaming. Switched to 'Upload / Take Photo' mode.", "info");
      this.setSourceMode("upload");
      return;
    }

    try {
      const mode = this.currentFacingMode || "environment";
      this.webcamStream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          width: { ideal: 1920 }, 
          height: { ideal: 1080 },
          facingMode: { ideal: mode }
        } 
      });
      video.srcObject = this.webcamStream;
      const statusText = document.getElementById("cam-status-text");
      if (statusText) {
        statusText.textContent = `Camera Active (${mode === "environment" ? "Back" : "Front"})`;
      }
      const label = document.getElementById("cam-facing-label");
      if (label) {
        label.textContent = (mode === "environment") ? "Back Cam" : "Front Cam";
      }
    } catch (e) {
      console.warn("Webcam access error with ideal constraints, trying fallback:", e);
      try {
        this.webcamStream = await navigator.mediaDevices.getUserMedia({ video: true });
        video.srcObject = this.webcamStream;
      } catch (err) {
        App.showToast("Camera streaming unavailable. Please use 'Upload / Take Photo' button.", "warning");
        this.setSourceMode("upload");
      }
    }
  },

  stopCamera() {
    if (this.webcamStream) {
      this.webcamStream.getTracks().forEach(t => t.stop());
      this.webcamStream = null;
    }
  },

  takeClassroomSnap() {
    const video = document.getElementById("multi-webcam-video");
    if (!video || !video.videoWidth) {
      App.showToast("Webcam is not ready yet", "warning");
      return;
    }

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(video, 0, 0);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.96);

    if (this.capturedClassroomSnaps.length >= 8) {
      App.showToast("Maximum 8 classroom angles reached", "info");
      return;
    }

    this.capturedClassroomSnaps.push(dataUrl);

    const counter = document.getElementById("cam-snap-counter");
    if (counter) counter.textContent = `${this.capturedClassroomSnaps.length} Angle(s) Snapped (Max 8)`;

    const strip = document.getElementById("cam-snap-strip");
    if (strip) {
      strip.innerHTML = this.capturedClassroomSnaps.map((s, idx) => `
        <div class="snap-thumb-item">
          <img src="${s}" />
          <span class="snap-thumb-badge">Angle ${idx + 1}</span>
        </div>
      `).join("");
    }

    App.showToast(`Angle #${this.capturedClassroomSnaps.length} captured! (1–8 allowed)`, "success");
  },

  onFilesSelected(input) {
    if (!input.files || input.files.length === 0) return;
    if (input.files.length > 8) {
      App.showToast("Maximum 8 photos allowed. First 8 photos selected.", "info");
    }
    this.uploadedFiles = Array.from(input.files).slice(0, 8);

    const strip = document.getElementById("upload-preview-strip");
    if (!strip) return;

    strip.classList.remove("hidden");
    strip.innerHTML = this.uploadedFiles.map((file, idx) => `
      <div class="snap-thumb-item">
        <img src="${URL.createObjectURL(file)}" />
        <span class="snap-thumb-badge">Angle ${idx + 1}</span>
      </div>
    `).join("");

    App.showToast(`${this.uploadedFiles.length} photo(s) selected (1–8 allowed).`, "info");
  },

  setupForm() {
    const form = document.getElementById("multi-capture-form");
    if (!form) return;

    form.onsubmit = async (e) => {
      e.preventDefault();

      // 1. Validate Department
      const deptSel = document.getElementById("multi-dept-select")?.value;
      const customDept = document.getElementById("custom-dept-input")?.value?.trim();
      if (deptSel === "OTHER" && !customDept) {
        App.showToast("Please enter a custom department name", "warning");
        document.getElementById("custom-dept-input")?.focus();
        return;
      }
      const finalDept = deptSel === "OTHER" ? customDept : deptSel;

      // 2. Validate Program (Multi-Select)
      const selectedProgs = Array.from(this.selectedPrograms);
      const customProg = document.getElementById("custom-prog-input")?.value?.trim();
      if (this.hasOtherProgram && !customProg) {
        App.showToast("Please enter a custom program / degree", "warning");
        document.getElementById("custom-prog-input")?.focus();
        return;
      }
      const finalProgs = [...selectedProgs];
      if (this.hasOtherProgram && customProg) finalProgs.push(customProg);
      const finalProg = finalProgs.length > 0 ? finalProgs.join(", ") : "All Programs";

      // 3. Validate Semester (Multi-Select)
      const selectedSems = Array.from(this.selectedSemesters);
      const customSem = document.getElementById("custom-sem-input")?.value?.trim();
      if (this.hasOtherSemester && !customSem) {
        App.showToast("Please enter a custom semester", "warning");
        document.getElementById("custom-sem-input")?.focus();
        return;
      }
      const finalSems = [...selectedSems];
      if (this.hasOtherSemester && customSem) finalSems.push(customSem);
      const finalSem = finalSems.length > 0 ? finalSems.join(", ") : "All Semesters";

      // 4. Validate Division (Multi-Select)
      const selectedDivs = Array.from(this.selectedDivisions);
      const customDiv = document.getElementById("custom-div-input")?.value?.trim();
      if (this.hasOtherDivision && !customDiv) {
        App.showToast("Please enter a custom division / section name", "warning");
        document.getElementById("custom-div-input")?.focus();
        return;
      }

      const finalDivs = [...selectedDivs];
      if (this.hasOtherDivision && customDiv) finalDivs.push(customDiv);
      const finalDivStr = finalDivs.length > 0 ? finalDivs.join(", ") : "All Divisions";

      // 5. Validate Course
      const courseSelect = document.getElementById("multi-class-select");
      const classId = courseSelect?.value;
      const customCode = document.getElementById("custom-course-code-input")?.value?.trim();
      const customTitle = document.getElementById("custom-course-title-input")?.value?.trim();

      if (!classId) {
        App.showToast("Please select a course offering", "warning");
        return;
      }

      if (classId === "OTHER") {
        if (!customCode) {
          App.showToast("Please enter a custom course code", "warning");
          document.getElementById("custom-course-code-input")?.focus();
          return;
        }
        if (!customTitle) {
          App.showToast("Please enter a custom course title", "warning");
          document.getElementById("custom-course-title-input")?.focus();
          return;
        }
      }

      // 6. Validate Subject / Topic
      const sessionName = document.getElementById("multi-session-name")?.value?.trim();
      if (!sessionName) {
        App.showToast("Please enter a subject / lecture topic", "warning");
        document.getElementById("multi-session-name")?.focus();
        return;
      }

      const tolerance = parseFloat(this.institutionalTolerance || "0.50");

      const scanBtn = document.getElementById("multi-scan-btn");
      scanBtn.disabled = true;
      scanBtn.innerHTML = `<span class="spinner-sm mr-2"></span> Detecting Faces & Matching...`;

      const statusText = document.getElementById("session-status-text");
      if (statusText) statusText.textContent = "Processing Multi-Face Biometrics...";

      try {
        let session;
        const fd = new FormData();
        fd.append("class_id", classId);
        fd.append("session_name", sessionName);
        fd.append("tolerance", tolerance);
        fd.append("department", finalDept);
        fd.append("program", finalProg);
        fd.append("semester", finalSem);
        fd.append("section", finalDivStr);

        // Collect all multi-division class IDs
        if (classId !== "OTHER") {
          const selectedOpt = courseSelect.selectedOptions[0];
          const classIdsAttr = selectedOpt?.getAttribute("data-class-ids");
          if (classIdsAttr) {
            fd.append("class_ids", classIdsAttr);
          }
        } else {
          fd.append("custom_code", customCode);
          fd.append("custom_name", customTitle);
        }

        const uploadBox = document.getElementById("src-upload-box");
        const isUploadVisible = uploadBox && !uploadBox.classList.contains("hidden");
        const fileInput = document.getElementById("multi-file-input");
        const filesToUpload = (fileInput && fileInput.files && fileInput.files.length > 0)
          ? Array.from(fileInput.files)
          : (this.uploadedFiles || []);

        if (this.activeMode === "upload" || isUploadVisible || filesToUpload.length > 0) {
          if (filesToUpload.length === 0) {
            App.showToast("Please select at least 1 classroom photo (1–8 photos)", "warning");
            scanBtn.disabled = false;
            scanBtn.innerHTML = `<i data-lucide="scan" class="w-4 h-4"></i><span>Scan & Aggregate Attendance</span>`;
            return;
          }
          filesToUpload.slice(0, 8).forEach(f => fd.append("photos", f));
          session = await API.post("/sessions/create-and-process", fd);
        } else if (this.activeMode === "camera") {
          if (this.capturedClassroomSnaps.length === 0) {
            App.showToast("Please snap at least 1 classroom angle first (1–8 angles)", "warning");
            scanBtn.disabled = false;
            scanBtn.innerHTML = `<i data-lucide="scan" class="w-4 h-4"></i><span>Scan & Aggregate Attendance</span>`;
            return;
          }
          const snapsToSend = this.capturedClassroomSnaps.slice(0, 8);
          fd.append("webcam_snapshots_json", JSON.stringify(snapsToSend));
          session = await API.post("/sessions/create-and-process", fd);
        }

        App.showToast("Attendance biometric analysis complete!", "success");
        this.renderResults(session, true);

      } catch (err) {
        App.showToast(err.message || "Failed to process attendance", "error");
      } finally {
        scanBtn.disabled = false;
        scanBtn.innerHTML = `<i data-lucide="scan" class="w-4 h-4"></i><span>Scan & Aggregate Attendance</span>`;
        if (window.lucide) window.lucide.createIcons();
      }
    };
  },

  // ===================================================================
  // BIOMETRICS PROCESSED & VERIFICATION SECTION (REDESIGNED LOWER AREA)
  // ===================================================================

  renderResults(session, shouldScroll = false) {
    const currentScrollTop = window.pageYOffset || document.documentElement.scrollTop || window.scrollY || 0;
    const resBox = document.getElementById("multi-attendance-results");
    if (!resBox) return;

    this.processedResult = session;
    this.activePhotoIndex = 0;
    this.currentZoom = 1.0;
    this.galleryMode = "focus";
    this.activeVerificationFilter = "all";

    // Build Photo URLs list
    let photoUrls = [];
    if (session.processed_photo_paths && session.processed_photo_paths.length > 0) {
      photoUrls = session.processed_photo_paths.map(p => {
        const filename = p.split(/[\/\\]/).pop();
        return `/uploads/sessions/${filename}`;
      });
    } else if (session.processed_photo_path) {
      const filename = session.processed_photo_path.split(/[\/\\]/).pop();
      photoUrls = [`/uploads/sessions/${filename}`];
    } else {
      photoUrls = ["/images/placeholder_session.jpg"];
    }

    const allRecords = session.records || [];
    const isRecordFrozen = (r) => Boolean(r.is_frozen || r.attendance_status === "FROZEN" || r.status === "FROZEN" || r.verification_type === "FROZEN_STUDENT");

    // 1. NORMAL SELECTED CLASS RECORDS
    const regularRecords = allRecords.filter(r => !r.is_extra_lecture && r.verification_type !== "EXTRA_LECTURE" && r.attendance_type !== "EXTRA_LECTURE");
    const presentRecords = regularRecords.filter(r => !isRecordFrozen(r) && (r.status === "PRESENT" || r.status === "LATE"));
    const frozenRecords = regularRecords.filter(r => isRecordFrozen(r));
    const absentRecords = regularRecords.filter(r => !isRecordFrozen(r) && r.status === "ABSENT");

    // 2. EXTRA LECTURE CANDIDATES (Outside Roster Registered Students)
    const extraCandidates = session.extra_candidates || [];
    const approvedExtraCount = extraCandidates.filter(c => c.is_approved || c.status === "APPROVED").length;
    const ignoredExtraCount = extraCandidates.filter(c => c.status === "IGNORED").length;

    // 3. UNKNOWN & SPOOF
    const unknowns = session.unknown_faces || [];
    const spoofRecords = (session.spoof_faces || []).concat(allRecords.filter(r => r.verification_type === "SPOOF_REJECTED" || r.notes?.includes("Spoof")));

    // Group regular records by division for precise isolation
    const divisionGroupsMap = new Map();
    regularRecords.forEach(r => {
      const divKey = r.section || "A";
      if (!divisionGroupsMap.has(divKey)) {
        divisionGroupsMap.set(divKey, {
          division: divKey,
          total: 0,
          present: 0,
          absent: 0,
          frozen: 0,
          records: []
        });
      }
      const g = divisionGroupsMap.get(divKey);
      g.total += 1;
      const isFrozen = isRecordFrozen(r);
      const isPresent = !isFrozen && (r.status === "PRESENT" || r.status === "LATE");
      if (isPresent) g.present += 1;
      else if (isFrozen) g.frozen += 1;
      else g.absent += 1;
      g.records.push(r);
    });

    const divisionGroups = Array.from(divisionGroupsMap.values()).sort((a, b) => a.division.localeCompare(b.division));

    // Update Telemetry Panel in upper right
    const kpiDet = document.getElementById("kpi-detected-val");
    const kpiPres = document.getElementById("kpi-present-val");
    const kpiAbs = document.getElementById("kpi-absent-val");
    const kpiUnk = document.getElementById("kpi-unknown-val");
    const stBadge = document.getElementById("session-telemetry-badge");
    const stText = document.getElementById("session-status-text");

    if (kpiDet) kpiDet.textContent = session.total_detected || (presentRecords.length + unknowns.length + extraCandidates.length);
    if (kpiPres) kpiPres.textContent = presentRecords.length;
    if (kpiAbs) kpiAbs.textContent = absentRecords.length;
    if (kpiUnk) kpiUnk.textContent = unknowns.length;

    if (stBadge) {
      stBadge.className = "badge badge-present text-[10px]";
      stBadge.textContent = "Aggregated";
    }
    if (stText) {
      stText.textContent = "Attendance Ready for Review";
    }

    resBox.classList.remove("hidden");
    resBox.innerHTML = `
      <div class="glass-panel mt-6" id="attendance-results-section">
        
        <!-- 1. BIOMETRICS PROCESSED HEADER -->
        <div class="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-200 mb-5">
          <div>
            <div class="flex items-center gap-2 mb-1">
              <h3 class="text-lg font-bold text-slate-900">Biometrics Processed</h3>
              <span class="badge badge-present text-xs">YOLO Face • MiniFASNetV2 • ArcFace</span>
            </div>
            <div class="flex flex-wrap items-center gap-2 text-xs text-slate-500">
              <span class="font-bold text-slate-800">${session.course_name || session.session_name}</span>
              <span>&bull;</span>
              <span>Selected Class: <b class="text-emerald-700">${presentRecords.length} Present</b>, <b class="text-rose-700">${absentRecords.length} Absent</b>${frozenRecords.length > 0 ? `, <b class="text-cyan-700 font-bold">${frozenRecords.length} Frozen</b>` : ''} (${regularRecords.length} Enrolled)</span>
              <span>&bull;</span>
              <span>Extra Lecture: <b class="text-amber-700">${extraCandidates.length} Detected</b> (<b class="text-emerald-700">${approvedExtraCount} Approved</b>)</span>
              <span>&bull;</span>
              <span>Unknown: <b class="text-indigo-700">${unknowns.length}</b></span>
              <span>&bull;</span>
              <span>Spoof: <b class="text-rose-700">${spoofRecords.length}</b></span>
            </div>
          </div>

          <div class="flex items-center gap-2.5">
            <button type="button" class="btn-secondary btn-sm flex items-center gap-1.5" onclick="CaptureView.recaptureImages()" title="Retake or upload new images for this lecture without losing academic settings">
              <i data-lucide="refresh-cw" class="w-3.5 h-3.5 text-slate-600"></i>
              <span>Re-Capture / Replace Images</span>
            </button>
            <button type="button" class="btn-primary btn-sm flex items-center gap-1.5" onclick="CaptureView.openFinalizeModal(${session.id})">
              <i data-lucide="check-circle" class="w-3.5 h-3.5"></i>
              <span>Save & Finalize Attendance</span>
            </button>
          </div>
        </div>

        <!-- 2. SUMMARY BREAKDOWN CARDS -->
        <div class="division-summary-cards-grid">
          ${divisionGroups.map(g => `
            <div class="division-summary-card">
              <div class="div-card-header">
                <span class="div-pill">Selected Class • Div ${g.division}</span>
                <span class="div-enrolled-count">${g.total} Enrolled</span>
              </div>
              <div class="div-stats-row">
                <span class="text-emerald-600 font-bold font-mono">
                  <i data-lucide="check" class="w-3.5 h-3.5 inline"></i> ${g.present} Present
                </span>
                <span class="text-rose-600 font-bold font-mono">
                  <i data-lucide="x" class="w-3.5 h-3.5 inline"></i> ${g.absent} Absent
                </span>
                ${g.frozen > 0 ? `
                  <span class="text-cyan-700 font-bold font-mono">
                    ❄️ ${g.frozen} Frozen
                  </span>
                ` : ''}
              </div>
            </div>
          `).join("")}

          <!-- Extra Lecture Candidates Card -->
          <div class="division-summary-card" style="border-color: rgba(245, 158, 11, 0.4); background: #fffbeb;">
            <div class="div-card-header">
              <span class="div-pill bg-amber-100 text-amber-900 border-amber-300">🟠 Extra Lecture Candidates</span>
              <span class="div-enrolled-count text-amber-800 font-bold">${extraCandidates.length} Detected</span>
            </div>
            <div class="div-stats-row">
              <span class="text-emerald-700 font-bold font-mono">${approvedExtraCount} Approved</span>
              <span class="text-slate-500 font-bold font-mono">${ignoredExtraCount} Ignored</span>
            </div>
          </div>

          <!-- Unidentified Faces Card -->
          <div class="division-summary-card overall-card">
            <div class="div-card-header">
              <span class="div-pill bg-indigo-100 text-indigo-800">Unidentified / Spoof</span>
              <span class="div-enrolled-count">${unknowns.length + spoofRecords.length} Faces</span>
            </div>
            <div class="div-stats-row">
              <span class="text-indigo-700 font-bold font-mono">${unknowns.length} Unknown Faces</span>
              <span class="text-rose-700 font-bold font-mono ml-auto">${spoofRecords.length} Spoof Rejected</span>
            </div>
          </div>
        </div>

        <!-- 3. LARGE CLASSROOM IMAGE VIEWER -->
        <div class="photo-viewer-card mb-3">
          <!-- Top Toolbar: Angle Switcher + Mode + Zoom Controls -->
          <div class="photo-viewer-toolbar">
            <div class="photo-angle-tabs">
              ${photoUrls.map((url, idx) => `
                <button type="button" class="angle-tab-btn ${idx === this.activePhotoIndex ? 'active' : ''}" onclick="CaptureView.switchPhoto(${idx})">
                  <i data-lucide="camera" class="w-3.5 h-3.5"></i>
                  <span>Angle ${idx + 1}</span>
                </button>
              `).join("")}
            </div>

            <div class="flex items-center gap-2">
              <div class="photo-view-mode-toggle">
                <button type="button" class="view-mode-btn ${this.galleryMode === 'focus' ? 'active' : ''}" id="btn-view-focus" onclick="CaptureView.setGalleryMode('focus')" title="Single Angle Large View">
                  <i data-lucide="square" class="w-3.5 h-3.5"></i>
                  <span class="text-[11px] ml-1">Single Angle</span>
                </button>
                <button type="button" class="view-mode-btn ${this.galleryMode === 'grid' ? 'active' : ''}" id="btn-view-grid" onclick="CaptureView.setGalleryMode('grid')" title="Side-by-Side Angles">
                  <i data-lucide="grid" class="w-3.5 h-3.5"></i>
                  <span class="text-[11px] ml-1">Side-by-Side</span>
                </button>
              </div>

              <div class="photo-zoom-controls" id="photo-zoom-controls">
                <button type="button" class="btn-zoom" onclick="CaptureView.adjustZoom(-0.15)" title="Zoom Out"><i data-lucide="minus"></i></button>
                <span class="zoom-text" id="zoom-level-text">100%</span>
                <button type="button" class="btn-zoom" onclick="CaptureView.adjustZoom(0.15)" title="Zoom In"><i data-lucide="plus"></i></button>
                <button type="button" class="btn-zoom" onclick="CaptureView.resetZoom()" title="Reset Zoom"><i data-lucide="rotate-ccw"></i></button>
              </div>

              <button type="button" class="btn-zoom" onclick="App.showImageLightbox('${photoUrls[this.activePhotoIndex]}', 'Angle ${this.activePhotoIndex + 1}')" title="Inspect Fullscreen Lightbox">
                <i data-lucide="maximize-2"></i>
              </button>
            </div>
          </div>

          <!-- Single Angle Large Canvas -->
          <div class="photo-canvas-frame" id="focus-photo-box">
            <div class="zoomable-photo-wrapper" id="image-zoom-wrapper">
              <img id="active-classroom-photo" src="${photoUrls[this.activePhotoIndex] || ''}" alt="Classroom Detection View" />
            </div>
          </div>

          <!-- Side-by-Side Matrix Mode -->
          <div class="photo-grid-matrix hidden" id="grid-photo-box">
            ${photoUrls.map((url, idx) => `
              <div class="photo-grid-card" onclick="CaptureView.switchPhoto(${idx}); CaptureView.setGalleryMode('focus');">
                <img src="${url}" />
                <span class="grid-card-label">Angle ${idx + 1}</span>
              </div>
            `).join("")}
          </div>
        </div>

        <!-- 4. AI RESULT LEGEND BAR -->
        <div class="ai-result-legend-bar">
          <div class="legend-item">
            <span class="legend-box green"></span>
            <span>Green Box = Recognized Selected Class Student</span>
          </div>
          <div class="legend-item">
            <span class="legend-box orange"></span>
            <span>Orange Box = Extra Lecture Candidate / Spoof Rejected</span>
          </div>
          <div class="legend-item">
            <span class="legend-box red"></span>
            <span>Red Box = Unidentified Face</span>
          </div>
          <span class="text-[11px] font-mono text-slate-400 ml-auto">YOLOv8 Face &bull; ArcFace (Cosine Sim)</span>
        </div>

        <!-- 5. ATTENDANCE VERIFICATION SECTION -->
        <div class="mt-6">
          <div class="flex flex-wrap items-center justify-between gap-3 mb-3">
            <h4 class="text-sm font-bold text-slate-900 uppercase tracking-wider">Attendance Verification & Review</h4>
            <span class="text-xs text-slate-500">Normal class attendance vs. outside-roster extra lecture candidates</span>
          </div>

          <!-- Navigation Filter Tabs -->
          <div class="verification-nav-bar">
            <button type="button" class="v-tab-btn active" id="v-tab-all" onclick="CaptureView.setVerificationFilter('all')">
              <span>All Results</span>
              <span class="v-tab-badge bg-slate-200 text-slate-700">${regularRecords.length + extraCandidates.length + unknowns.length + spoofRecords.length}</span>
            </button>
            <button type="button" class="v-tab-btn" id="v-tab-roster" onclick="CaptureView.setVerificationFilter('roster')">
              <span>Normal Class Attendance</span>
              <span class="v-tab-badge present">${presentRecords.length}P / ${absentRecords.length}A${frozenRecords.length > 0 ? ` / ${frozenRecords.length}❄️` : ''}</span>
            </button>
            <button type="button" class="v-tab-btn" id="v-tab-extra" onclick="CaptureView.setVerificationFilter('extra')">
              <span>🟠 Extra Lecture Candidates</span>
              <span class="v-tab-badge" style="background: rgba(245, 158, 11, 0.2); color: #b45309;">${extraCandidates.length}</span>
            </button>
            <button type="button" class="v-tab-btn" id="v-tab-unknown" onclick="CaptureView.setVerificationFilter('unknown')">
              <span>Unidentified Faces</span>
              <span class="v-tab-badge unknown">${unknowns.length}</span>
            </button>
            <button type="button" class="v-tab-btn" id="v-tab-spoof" onclick="CaptureView.setVerificationFilter('spoof')">
              <span>Spoof Rejected</span>
              <span class="v-tab-badge spoof">${spoofRecords.length}</span>
            </button>
          </div>

          <!-- CONTAINER FOR FILTERED SECTIONS -->
          <div id="verification-content-area" class="space-y-6">

            <!-- SECTION 1: NORMAL SELECTED CLASS ATTENDANCE -->
            <div id="v-section-roster" class="space-y-5">
              <div class="flex items-center justify-between pb-2 border-b border-slate-200">
                <div class="flex items-center gap-2">
                  <span class="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                  <h5 class="text-xs font-bold text-slate-900 uppercase tracking-wider">Normal Selected Class Attendance</h5>
                </div>
                <span class="text-xs text-slate-500">Only enrolled students in selected division(s) participate in normal class attendance</span>
              </div>

              ${divisionGroups.length === 0 ? `
                <div class="p-6 bg-slate-50 border border-slate-200 rounded-xl text-center text-slate-400 text-xs">
                  No registered student roster is associated with this selected context.
                </div>
              ` : divisionGroups.map(dg => {
                return `
                  <div class="division-roster-group" id="div-group-${dg.division}">
                    <div class="division-roster-header">
                      <div class="flex items-center gap-2">
                        <span class="div-pill">Division ${dg.division}</span>
                        <span class="text-xs text-slate-600 font-semibold">${dg.records.length} Students Enrolled</span>
                      </div>
                      <div class="flex items-center gap-3 text-xs font-mono">
                        <span class="text-emerald-700 font-bold">${dg.present} Present</span>
                        <span class="text-rose-700 font-bold">${dg.absent} Absent</span>
                        ${dg.frozen > 0 ? `<span class="text-cyan-700 font-bold">❄️ ${dg.frozen} Frozen</span>` : ''}
                      </div>
                    </div>

                    <div class="p-3 space-y-2">
                      ${dg.records.map(r => {
                        const isFrozen = isRecordFrozen(r);
                        const isPresent = !isFrozen && (r.status === "PRESENT" || r.status === "LATE");
                        const isOverridden = r.verification_type === "MANUAL_OVERRIDE";
                        const matchPct = r.confidence_score ? Math.round(r.confidence_score * 100) / 100 : 0;
                        const studentPhoto = r.student_photo_url ? (r.student_photo_url.startsWith('http') || r.student_photo_url.startsWith('/') ? r.student_photo_url : `/uploads/students/${r.student_photo_url.split(/[\/\\]/).pop()}`) : null;

                        let cardClass = "is-absent";
                        let avatarClass = "absent";
                        if (isFrozen) {
                          cardClass = "is-frozen";
                          avatarClass = "frozen";
                        } else if (isPresent) {
                          cardClass = "is-present";
                          avatarClass = "present";
                        }

                        return `
                          <div class="student-verification-card ${cardClass}" id="student-row-${r.id}" data-status="${isFrozen ? 'frozen' : r.status.toLowerCase()}"
                            style="${isFrozen ? 'border-color: #a5f3fc; background: rgba(236,254,255,0.45);' : ''}">
                            <div class="flex items-center gap-3 min-w-0">
                              <!-- Face Avatar / Registered Student Photo -->
                              <div class="student-avatar-box ${avatarClass}" style="${isFrozen ? 'border: 2px solid #0891b2; background: #ecfeff;' : ''}">
                                ${studentPhoto ? `
                                  <img src="${studentPhoto}" alt="${r.student_name}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%;" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';" />
                                  <span class="avatar-letter hidden">${(r.student_name || 'S').charAt(0)}</span>
                                ` : `
                                  <span class="avatar-letter" style="${isFrozen ? 'color:#0891b2; font-weight:800;' : ''}">${isFrozen ? '❄️' : (r.student_name || 'S').charAt(0)}</span>
                                `}
                              </div>
                              <div class="truncate">
                                <div class="flex items-center gap-2 mb-0.5">
                                  <span class="font-bold text-slate-900 text-xs truncate">${r.student_name || 'Enrolled Student'}</span>
                                  <span class="font-mono text-[11px] text-slate-500 font-semibold">(${r.roll_number || 'N/A'})</span>
                                  <span class="badge text-[10px] bg-slate-100 text-slate-700">Div ${r.section || dg.division}</span>
                                  ${isFrozen ? `
                                    <span class="badge text-[10px] py-0 px-2 font-bold" style="background:#cffafe; color:#0e7490; border: 1px solid #a5f3fc;">
                                      ❄️ FROZEN
                                    </span>
                                  ` : ''}
                                </div>
                                <div class="flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                                  ${isFrozen ? `
                                    <span class="font-semibold text-cyan-800">
                                      ${matchPct > 0 ? `❄️ Detected in Photos (${matchPct}% Match)` : `❄️ Attendance Frozen`}
                                    </span>
                                    <span>&bull;</span>
                                    <span class="text-cyan-900 font-bold">Status: <b>FROZEN (Exempt)</b></span>
                                    ${r.freeze_until ? `<span class="text-[10px] text-cyan-700 font-mono">(until ${r.freeze_until})</span>` : ''}
                                    ${r.freeze_reason ? `<span class="text-slate-400">&bull; ${r.freeze_reason}</span>` : ''}
                                  ` : `
                                    <span class="font-semibold ${isPresent ? 'text-emerald-600' : 'text-slate-400'}">
                                      ${isPresent ? (matchPct > 0 ? `✓ ${matchPct}% Match` : '✓ Verified') : 'Not Detected in Photos'}
                                    </span>
                                    <span>&bull;</span>
                                    <span class="text-slate-600">Status: <b>${isPresent ? 'Present' : 'Absent'}</b></span>
                                    ${isOverridden ? `
                                      <span class="manual-override-badge">
                                        <i data-lucide="edit-3" class="w-3 h-3"></i> Manual Override
                                      </span>
                                    ` : ''}
                                  `}
                                </div>
                              </div>
                            </div>

                            <!-- Right Action Area -->
                            <div class="flex items-center gap-2 flex-shrink-0">
                              ${isFrozen ? `
                                <div class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-100/80 border border-cyan-300 text-cyan-950 text-xs font-bold shadow-xs">
                                  <i data-lucide="snowflake" class="w-3.5 h-3.5 text-cyan-700"></i>
                                  <span>Frozen (Exempt)</span>
                                </div>
                              ` : `
                                <div class="status-toggle-group">
                                  <button type="button" class="status-toggle-btn ${isPresent ? 'active-present' : ''}" onclick="CaptureView.updateStudentStatus(${r.id}, 'PRESENT')">
                                    Present
                                  </button>
                                  <button type="button" class="status-toggle-btn ${!isPresent ? 'active-absent' : ''}" onclick="CaptureView.updateStudentStatus(${r.id}, 'ABSENT')">
                                    Absent
                                  </button>
                                </div>
                                ${!isPresent ? `
                                  <button type="button" class="btn-secondary text-[11px] py-1 px-2 text-indigo-600 hover:bg-indigo-50" onclick="CaptureView.openQuickSnapModal(${session.id}, ${r.student_id}, '${r.student_name}', ${r.id})" title="Verify Student Live with Webcam">
                                    <i data-lucide="camera" class="w-3.5 h-3.5"></i>
                                  </button>
                                ` : ''}
                              `}
                            </div>
                          </div>
                        `;
                      }).join("")}
                    </div>
                  </div>
                `;
              }).join("")}
            </div>

            <!-- SECTION 2: EXTRA LECTURE CANDIDATES (Registered Students from Other Classes) -->
            <div id="v-section-extra" class="p-4 bg-amber-50/60 border border-amber-200 rounded-xl">
              <div class="flex flex-wrap items-center justify-between gap-2 mb-3 pb-2 border-b border-amber-200">
                <div class="flex items-center gap-2">
                  <span class="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
                  <h5 class="text-xs font-bold text-amber-950 uppercase tracking-wider">Registered Students — Other Class (${extraCandidates.length})</h5>
                </div>
                <span class="text-xs text-amber-800">Recognized institutional students outside selected roster &bull; Approving grants +1 Extra Lecture</span>
              </div>

              ${extraCandidates.length === 0 ? `
                <div class="p-5 bg-white border border-amber-100 rounded-lg text-center text-slate-400 text-xs">
                  <i data-lucide="users" class="w-5 h-5 mx-auto mb-1 text-slate-300"></i>
                  No outside-roster students detected in this session.
                </div>
              ` : `
                <div class="extra-candidates-grid">
                  ${extraCandidates.map(c => {
                    const isApproved = Boolean(c.is_approved || c.status === "APPROVED");
                    const isIgnored = Boolean(c.status === "IGNORED");
                    const isFrozen = Boolean(c.is_frozen || c.attendance_status === "FROZEN");
                    const freezeUntilStr = c.freeze_until ? ` until ${new Date(c.freeze_until).toLocaleDateString('en-IN', {day:'2-digit',month:'short',year:'numeric'})}` : '';
                    const photo = c.student_photo_url ? (c.student_photo_url.startsWith('http') || c.student_photo_url.startsWith('/') ? c.student_photo_url : `/uploads/students/${c.student_photo_url.split(/[\/\\]/).pop()}`) : null;

                    return `
                      <div class="extra-candidate-card ${isApproved ? 'is-approved' : (isIgnored ? 'is-ignored' : '')} ${isFrozen ? 'border-cyan-300' : ''}" id="extra-card-${c.student_id}" ${isFrozen ? 'style="border-color: #a5f3fc; background: rgba(236,254,255,0.35);"' : ''}>
                        <div class="flex items-start gap-3">
                          <div class="extra-avatar-box" ${isFrozen ? 'style="border-color: #67e8f9;"' : ''}>
                            ${photo ? `
                              <img src="${photo}" alt="${c.student_name}" style="width: 100%; height: 100%; object-fit: cover;" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';" />
                              <span class="avatar-letter hidden">${(c.student_name || 'S').charAt(0)}</span>
                            ` : `
                              <span class="avatar-letter ${isFrozen ? 'text-cyan-800' : 'text-amber-800'} font-bold">${(c.student_name || 'S').charAt(0)}</span>
                            `}
                          </div>
                          <div class="min-w-0 flex-1">
                            <div class="flex items-center flex-wrap gap-1.5 mb-0.5">
                              <span class="font-bold text-slate-900 text-xs truncate">${c.student_name}</span>
                              <span class="font-mono text-[11px] text-slate-500 font-semibold">(${c.roll_number})</span>
                              ${isFrozen ? `
                                <span class="badge text-[9px] font-bold bg-cyan-100 text-cyan-800 border border-cyan-300 py-0 px-1.5" title="Student Attendance is Frozen${freezeUntilStr}: ${c.freeze_reason || 'Administrative hold'}">
                                  ❄️ FROZEN${freezeUntilStr}
                                </span>
                              ` : ''}
                            </div>
                            <div class="text-[11px] text-slate-600 font-medium">
                              <span>${c.program || 'B.Tech'}</span> &bull; 
                              <span>${c.semester || 'Sem 1'}</span> &bull; 
                              <span class="font-bold text-slate-800">Div ${c.division || 'A'}</span>
                            </div>
                            <div class="text-[10px] text-slate-500 mt-0.5">
                              Regular: ${c.department || 'Computer Science'}
                            </div>
                            ${isFrozen ? `
                              <div class="text-[10px] text-cyan-800 bg-cyan-50 border border-cyan-200 rounded px-1.5 py-0.5 mt-1 leading-tight font-medium">
                                ❄️ <strong>Frozen:</strong> ${c.freeze_reason || 'Administrative hold'}${c.freeze_until ? ` &bull; Auto-unfreeze on ${new Date(c.freeze_until).toLocaleDateString('en-IN', {day:'2-digit',month:'short'})}` : ''}
                              </div>
                            ` : ''}
                          </div>
                        </div>

                        <div class="flex items-center justify-between pt-2 border-t border-amber-200/60" ${isFrozen ? 'style="border-color: rgba(165,243,252,0.8);"' : ''}>
                          <div>
                            ${isApproved ? `
                              <span class="extra-candidate-badge approved">
                                <i data-lucide="check-circle" class="w-3 h-3"></i> Approved (+1 Extra)
                              </span>
                            ` : (isIgnored ? `
                              <span class="extra-candidate-badge ignored">
                                <i data-lucide="minus-circle" class="w-3 h-3"></i> Rejected
                              </span>
                            ` : (isFrozen ? `
                              <span class="extra-candidate-badge" style="background: #cffafe; color: #0891b2; border: 1px solid #a5f3fc; font-weight: 700;">
                                <i data-lucide="snowflake" class="w-3 h-3"></i> ❄️ Frozen Student
                              </span>
                            ` : `
                              <span class="extra-candidate-badge">
                                <i data-lucide="alert-circle" class="w-3 h-3"></i> Extra Lecture
                              </span>
                            `))}
                          </div>
                          <span class="text-[10px] font-mono text-slate-400">Match: ${c.confidence ? Math.round(c.confidence) + '%' : 'Verified'}</span>
                        </div>

                        <!-- Action Buttons -->
                        <div class="flex items-center gap-2 mt-auto">
                          ${!isApproved ? `
                            <button type="button" class="btn-extra-approve" onclick="CaptureView.approveExtraLecture(${session.id}, ${c.student_id})" ${isFrozen ? 'style="background: linear-gradient(135deg, #0284c7, #0369a1); border-color: #0284c7;"' : ''}>
                              <i data-lucide="plus-circle" class="w-3.5 h-3.5"></i>
                              <span>${isFrozen ? 'Approve (Grant Extra)' : 'Approve Extra Lecture'}</span>
                            </button>
                          ` : `
                            <button type="button" class="btn-extra-approve approved" onclick="CaptureView.ignoreExtraLecture(${session.id}, ${c.student_id})">
                              <i data-lucide="check" class="w-3.5 h-3.5"></i>
                              <span>Approved (Click to Undo)</span>
                            </button>
                          `}
                          ${!isIgnored ? `
                            <button type="button" class="btn-extra-ignore" onclick="CaptureView.ignoreExtraLecture(${session.id}, ${c.student_id})" title="Reject Candidate">
                              <i data-lucide="x" class="w-3.5 h-3.5"></i>
                              <span>Reject</span>
                            </button>
                          ` : `
                            <button type="button" class="btn-extra-approve" onclick="CaptureView.approveExtraLecture(${session.id}, ${c.student_id})">
                              <span>Re-Approve</span>
                            </button>
                          `}
                        </div>
                      </div>
                    `;
                  }).join("")}
                </div>
              `}
            </div>

            <!-- SECTION 3: UNIDENTIFIED FACE CROPS (Responsive Grid) -->
            <div id="v-section-unknowns" class="p-4 bg-slate-50 border border-slate-200 rounded-xl ${unknowns.length === 0 ? 'hidden' : ''}">
              <div class="flex items-center justify-between mb-3 pb-2 border-b border-slate-200">
                <div class="flex items-center gap-2">
                  <span class="w-2.5 h-2.5 rounded-full bg-rose-500"></span>
                  <h5 class="text-xs font-bold text-slate-900 uppercase tracking-wider">Unidentified Face Crops (${unknowns.length})</h5>
                </div>
                <span class="text-xs text-slate-500">Faces detected by YOLO but not matched to any registered institutional student</span>
              </div>

              <div class="unknown-faces-responsive-grid" id="unknowns-cards-container">
                ${(this.showAllUnknowns || unknowns.length <= 18 ? unknowns : unknowns.slice(0, 18)).map((u, idx) => {
                  const rawPath = u.photo_url || u.crop_image_path || u.cropped_image_path || '';
                  const cropUrl = rawPath ? (rawPath.startsWith('http') || rawPath.startsWith('/') ? rawPath : `/uploads/unknown_faces/${rawPath.split(/[\/\\]/).pop()}`) : '';

                  return `
                    <div class="unknown-face-card" id="card-unk-${u.id}">
                      <div class="unknown-crop-preview">
                        ${cropUrl ? `
                          <img src="${cropUrl}" alt="Face #${u.id}" loading="lazy" decoding="async" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';" />
                          <div class="hidden flex flex-col items-center justify-center text-slate-400 p-2">
                            <i data-lucide="user-x" class="w-6 h-6"></i>
                            <span class="text-[9px] mt-1 font-semibold">No Image</span>
                          </div>
                        ` : `
                          <div class="flex flex-col items-center justify-center text-slate-400 p-2">
                            <i data-lucide="user-x" class="w-6 h-6"></i>
                            <span class="text-[9px] mt-1 font-semibold">No Image</span>
                          </div>
                        `}
                      </div>
                      <span class="font-bold text-slate-900 text-xs block mb-0.5">Face #${u.id || idx + 1}</span>
                      <span class="text-[10px] text-slate-400 mb-2 font-mono">Angle ${u.camera_id || 1}</span>

                      <div class="space-y-1.5 w-full mt-auto">
                        <button type="button" class="btn-primary text-[10px] py-1 px-2 w-full flex items-center justify-center gap-1" onclick="App.navigate('student_new', { unknownFaceId: ${u.id}, cropUrl: '${cropUrl}', sessionId: ${this.currentSession?.id || 'null'}, sessionName: '${(this.currentSession?.name || '').replace(/'/g, "\\'")}' })">
                          <i data-lucide="user-plus" class="w-3 h-3"></i> Enroll New
                        </button>
                        <button type="button" class="btn-secondary text-[10px] py-1 px-2 w-full flex items-center justify-center gap-1 text-indigo-700 hover:bg-indigo-50 border-indigo-200" onclick="CaptureView.openEnrollModal(${u.id}, '${cropUrl}')">
                          <i data-lucide="tag" class="w-3 h-3"></i> Tag Existing
                        </button>
                        <button type="button" class="btn-secondary text-[10px] py-1 px-2 w-full text-rose-600 hover:bg-rose-50 flex items-center justify-center gap-1" onclick="CaptureView.dismissUnknown(${u.id})">
                          <i data-lucide="trash-2" class="w-3 h-3"></i> Dismiss
                        </button>
                      </div>
                    </div>
                  `;
                }).join("")}
              </div>

              ${unknowns.length > 18 ? `
                <div class="mt-4 text-center">
                  <button type="button" class="btn-secondary text-xs font-bold py-2 px-6 shadow-sm" id="btn-toggle-unknowns" onclick="CaptureView.toggleShowAllUnknowns()" style="border-radius: 999px;">
                    <span>${this.showAllUnknowns ? 'Show Less (Show First 18)' : `Show All ${unknowns.length} Unidentified Faces (${unknowns.length - 18} More)`}</span>
                  </button>
                </div>
              ` : ''}
            </div>

            <!-- SECTION 4: SPOOF REJECTED SECTION -->
            <div id="v-section-spoof" class="p-4 bg-amber-50/80 border border-amber-200 rounded-xl ${spoofRecords.length === 0 ? 'hidden' : ''}">
              <div class="flex items-center justify-between mb-3 pb-2 border-b border-amber-200">
                <div class="flex items-center gap-2">
                  <span class="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
                  <h5 class="text-xs font-bold text-amber-900 uppercase tracking-wider">Spoof Protection Rejections (${spoofRecords.length})</h5>
                </div>
                <span class="text-xs text-amber-800">MiniFASNetV2 Anti-Spoofing flagged these attempts as non-live presentations</span>
              </div>

              <div class="space-y-2">
                ${spoofRecords.map(s => `
                  <div class="spoof-rejected-card">
                    <div class="flex items-center gap-3">
                      <div class="w-10 h-10 rounded-lg bg-amber-200 border border-amber-300 flex items-center justify-center text-amber-900 font-bold">
                        <i data-lucide="shield-alert" class="w-5 h-5"></i>
                      </div>
                      <div>
                        <span class="font-bold text-amber-950 text-xs block">SPOOF REJECTED &bull; Liveness Verification Failed</span>
                        <span class="text-[11px] text-amber-800">MiniFASNetV2: Photo Screen / Print Attack Detected &bull; Attendance Denied</span>
                      </div>
                    </div>
                    <span class="badge text-[10px] bg-amber-200 text-amber-900 font-bold border border-amber-300">
                      Attendance Denied
                    </span>
                  </div>
                `).join("")}
              </div>
            </div>

          </div>
        </div>

      </div>
    `;

    if (window.lucide) window.lucide.createIcons();

    // Smooth scroll down to results only on initial scan execution
    if (shouldScroll) {
      const resSec = document.getElementById("attendance-results-section");
      if (resSec && typeof resSec.scrollIntoView === 'function') {
        resSec.scrollIntoView({ behavior: 'smooth' });
      }
    } else {
      window.scrollTo({ top: currentScrollTop, behavior: 'instant' });
    }
  },

  setVerificationFilter(filter) {
    this.activeVerificationFilter = filter;

    document.querySelectorAll(".v-tab-btn").forEach(btn => btn.classList.remove("active"));
    document.getElementById(`v-tab-${filter}`)?.classList.add("active");

    const rosterSec = document.getElementById("v-section-roster");
    const extraSec = document.getElementById("v-section-extra");
    const unknownsSec = document.getElementById("v-section-unknowns");
    const spoofSec = document.getElementById("v-section-spoof");

    if (filter === "all") {
      if (rosterSec) rosterSec.classList.remove("hidden");
      if (extraSec) extraSec.classList.remove("hidden");
      if (unknownsSec) unknownsSec.classList.remove("hidden");
      if (spoofSec) spoofSec.classList.remove("hidden");
    } else if (filter === "roster") {
      if (rosterSec) rosterSec.classList.remove("hidden");
      if (extraSec) extraSec.classList.add("hidden");
      if (unknownsSec) unknownsSec.classList.add("hidden");
      if (spoofSec) spoofSec.classList.add("hidden");
    } else if (filter === "extra") {
      if (rosterSec) rosterSec.classList.add("hidden");
      if (extraSec) extraSec.classList.remove("hidden");
      if (unknownsSec) unknownsSec.classList.add("hidden");
      if (spoofSec) spoofSec.classList.add("hidden");
    } else if (filter === "unknown") {
      if (rosterSec) rosterSec.classList.add("hidden");
      if (extraSec) extraSec.classList.add("hidden");
      if (unknownsSec) unknownsSec.classList.remove("hidden");
      if (spoofSec) spoofSec.classList.add("hidden");
    } else if (filter === "spoof") {
      if (rosterSec) rosterSec.classList.add("hidden");
      if (extraSec) extraSec.classList.add("hidden");
      if (unknownsSec) unknownsSec.classList.add("hidden");
      if (spoofSec) spoofSec.classList.remove("hidden");
    }
  },

  toggleShowAllUnknowns() {
    this.showAllUnknowns = !this.showAllUnknowns;
    const container = document.getElementById("unknowns-cards-container");
    const toggleBtn = document.getElementById("btn-toggle-unknowns");
    if (!container || !this.processedResult) return;

    const unknowns = this.processedResult.unknown_faces || [];
    const displayed = this.showAllUnknowns ? unknowns : unknowns.slice(0, 18);

    container.innerHTML = displayed.map((u, idx) => {
      const rawPath = u.photo_url || u.crop_image_path || u.cropped_image_path || '';
      const cropUrl = rawPath ? (rawPath.startsWith('http') || rawPath.startsWith('/') ? rawPath : `/uploads/unknown_faces/${rawPath.split(/[\/\\]/).pop()}`) : '';

      return `
        <div class="unknown-face-card" id="card-unk-${u.id}">
          <div class="unknown-crop-preview">
            ${cropUrl ? `
              <img src="${cropUrl}" alt="Face #${u.id}" loading="lazy" decoding="async" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';" />
              <div class="hidden flex flex-col items-center justify-center text-slate-400 p-2">
                <i data-lucide="user-x" class="w-6 h-6"></i>
                <span class="text-[9px] mt-1 font-semibold">No Image</span>
              </div>
            ` : `
              <div class="flex flex-col items-center justify-center text-slate-400 p-2">
                <i data-lucide="user-x" class="w-6 h-6"></i>
                <span class="text-[9px] mt-1 font-semibold">No Image</span>
              </div>
            `}
          </div>
          <span class="font-bold text-slate-900 text-xs block mb-0.5">Face #${u.id || idx + 1}</span>
          <span class="text-[10px] text-slate-400 mb-2 font-mono">Angle ${u.camera_id || 1}</span>

          <div class="space-y-1.5 w-full mt-auto">
            <button type="button" class="btn-primary text-[10px] py-1 px-2 w-full flex items-center justify-center gap-1" onclick="App.navigate('student_new', { unknownFaceId: ${u.id}, cropUrl: '${cropUrl}', sessionId: ${this.currentSession?.id || 'null'}, sessionName: '${(this.currentSession?.name || '').replace(/'/g, "\\'")}' })">
              <i data-lucide="user-plus" class="w-3 h-3"></i> Enroll New
            </button>
            <button type="button" class="btn-secondary text-[10px] py-1 px-2 w-full flex items-center justify-center gap-1 text-indigo-700 hover:bg-indigo-50 border-indigo-200" onclick="CaptureView.openEnrollModal(${u.id}, '${cropUrl}')">
              <i data-lucide="tag" class="w-3 h-3"></i> Tag Existing
            </button>
            <button type="button" class="btn-secondary text-[10px] py-1 px-2 w-full text-rose-600 hover:bg-rose-50 flex items-center justify-center gap-1" onclick="CaptureView.dismissUnknown(${u.id})">
              <i data-lucide="trash-2" class="w-3 h-3"></i> Dismiss
            </button>
          </div>
        </div>
      `;
    }).join("");

    if (toggleBtn) {
      toggleBtn.innerHTML = this.showAllUnknowns
        ? `<span>Show Less (Show First 18)</span>`
        : `<span>Show All ${unknowns.length} Unidentified Faces (${unknowns.length - 18} More)</span>`;
    }

    if (window.lucide) window.lucide.createIcons();
  },

  async approveExtraLecture(sessionId, studentId) {
    try {
      const res = await API.post(`/attendance/session/${sessionId}/extra-lecture/approve`, { student_id: studentId });
      
      // Update in local memory
      if (this.processedResult) {
        if (this.processedResult.extra_candidates) {
          const cand = this.processedResult.extra_candidates.find(c => c.student_id === studentId);
          if (cand) {
            cand.is_approved = true;
            cand.status = "APPROVED";
          }
        }
        if (res.record && this.processedResult.records) {
          const existingIdx = this.processedResult.records.findIndex(r => r.student_id === studentId);
          if (existingIdx >= 0) {
            this.processedResult.records[existingIdx] = res.record;
          } else {
            this.processedResult.records.push(res.record);
          }
        }
        this.renderResults(this.processedResult);
        if (this.activeVerificationFilter !== "all") {
          this.setVerificationFilter(this.activeVerificationFilter);
        }
      }

      App.showToast("Extra Lecture attendance approved for student!", "success");
    } catch (e) {
      App.showToast(e.message || "Failed to approve extra lecture", "error");
    }
  },

  async ignoreExtraLecture(sessionId, studentId) {
    try {
      await API.post(`/attendance/session/${sessionId}/extra-lecture/ignore`, { student_id: studentId });

      if (this.processedResult) {
        if (this.processedResult.extra_candidates) {
          const cand = this.processedResult.extra_candidates.find(c => c.student_id === studentId);
          if (cand) {
            cand.is_approved = false;
            cand.status = "IGNORED";
          }
        }
        if (this.processedResult.records) {
          this.processedResult.records = this.processedResult.records.filter(r => !(r.student_id === studentId && (r.is_extra_lecture || r.verification_type === "EXTRA_LECTURE")));
        }
        this.renderResults(this.processedResult);
        if (this.activeVerificationFilter !== "all") {
          this.setVerificationFilter(this.activeVerificationFilter);
        }
      }

      App.showToast("Candidate ignored (no attendance recorded).", "info");
    } catch (e) {
      App.showToast(e.message || "Failed to ignore candidate", "error");
    }
  },

  async updateStudentStatus(recordId, newStatus) {
    try {
      await API.put(`/attendance/records/${recordId}`, { status: newStatus });
      
      // Update in local memory
      if (this.processedResult && this.processedResult.records) {
        const rec = this.processedResult.records.find(r => r.id === recordId);
        if (rec) {
          rec.status = newStatus;
          rec.verification_type = "MANUAL_OVERRIDE";
        }
      }

      App.showToast(`Updated student status to ${newStatus} (Manual Override recorded)`, "success");
      
      // Re-render results cleanly
      if (this.processedResult) {
        this.renderResults(this.processedResult);
        if (this.activeVerificationFilter !== "all") {
          this.setVerificationFilter(this.activeVerificationFilter);
        }
      }

    } catch (e) {
      App.showToast(e.message || "Failed to update record", "error");
    }
  },

  openFinalizeModal(sessionId) {
    if (!this.processedResult) return;

    const records = this.processedResult.records || [];
    const regularRecords = records.filter(r => !r.is_extra_lecture && r.verification_type !== "EXTRA_LECTURE" && r.attendance_type !== "EXTRA_LECTURE");
    const presentCount = regularRecords.filter(r => r.status === "PRESENT" || r.status === "LATE").length;
    const absentCount = regularRecords.filter(r => r.status === "ABSENT").length;
    
    const extraCandidates = this.processedResult.extra_candidates || [];
    const approvedExtraCount = extraCandidates.filter(c => c.is_approved || c.status === "APPROVED").length;
    const ignoredExtraCount = extraCandidates.filter(c => c.status === "IGNORED").length;

    const unknownCount = (this.processedResult.unknown_faces || []).length;
    const spoofCount = (this.processedResult.spoof_faces || []).concat(records.filter(r => r.verification_type === 'SPOOF_REJECTED')).length;

    const html = `
      <div class="modal-card" style="max-width: 520px;">
        <div class="modal-header">
          <div class="flex items-center gap-2">
            <i data-lucide="check-circle" class="w-5 h-5 text-emerald-600"></i>
            <span class="modal-title">Finalize Attendance Session</span>
          </div>
          <button class="btn-icon" onclick="App.closeModal()"><i data-lucide="x"></i></button>
        </div>
        <div class="modal-body space-y-4">
          <p class="text-xs text-slate-600">
            Please review the attendance breakdown before permanently saving this attendance session:
          </p>

          <div class="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-3 text-xs">
            <!-- Selected Class Section -->
            <div class="pb-2 border-b border-slate-200">
              <div class="flex items-center justify-between mb-1.5">
                <span class="font-bold text-slate-900 uppercase tracking-wider text-[11px]">SELECTED CLASS</span>
                <span class="badge text-[10px] bg-indigo-100 text-indigo-800 font-bold">${this.processedResult.course_name || this.processedResult.session_name || 'Academic Class'}</span>
              </div>
              <div class="grid grid-cols-3 gap-2 text-center">
                <div class="p-2 bg-white rounded-lg border border-slate-200">
                  <span class="text-[10px] text-slate-500 block">Enrolled</span>
                  <span class="font-mono font-bold text-slate-800 text-sm">${regularRecords.length}</span>
                </div>
                <div class="p-2 bg-emerald-50 rounded-lg border border-emerald-200">
                  <span class="text-[10px] text-emerald-700 block">Present</span>
                  <span class="font-mono font-bold text-emerald-700 text-sm">${presentCount}</span>
                </div>
                <div class="p-2 bg-rose-50 rounded-lg border border-rose-200">
                  <span class="text-[10px] text-rose-700 block">Absent</span>
                  <span class="font-mono font-bold text-rose-700 text-sm">${absentCount}</span>
                </div>
              </div>
            </div>

            <!-- Extra Lecture Section -->
            <div class="pb-2 border-b border-slate-200">
              <div class="flex items-center justify-between mb-1.5">
                <span class="font-bold text-amber-950 uppercase tracking-wider text-[11px]">EXTRA LECTURE</span>
                <span class="text-[10px] text-amber-800">Outside Selected Roster</span>
              </div>
              <div class="grid grid-cols-3 gap-2 text-center">
                <div class="p-2 bg-amber-50/80 rounded-lg border border-amber-200">
                  <span class="text-[10px] text-amber-800 block">Candidates</span>
                  <span class="font-mono font-bold text-amber-900 text-sm">${extraCandidates.length}</span>
                </div>
                <div class="p-2 bg-emerald-50 rounded-lg border border-emerald-200">
                  <span class="text-[10px] text-emerald-700 block">Approved</span>
                  <span class="font-mono font-bold text-emerald-700 text-sm">${approvedExtraCount}</span>
                </div>
                <div class="p-2 bg-slate-100 rounded-lg border border-slate-200">
                  <span class="text-[10px] text-slate-500 block">Ignored</span>
                  <span class="font-mono font-bold text-slate-700 text-sm">${ignoredExtraCount}</span>
                </div>
              </div>
            </div>

            <!-- Unknown & Spoof Section -->
            <div class="grid grid-cols-2 gap-2 text-center">
              <div class="p-2 bg-indigo-50/60 rounded-lg border border-indigo-200">
                <span class="text-[10px] text-indigo-700 block font-semibold">UNKNOWN FACES</span>
                <span class="font-mono font-bold text-indigo-900 text-sm">${unknownCount}</span>
              </div>
              <div class="p-2 bg-rose-50/60 rounded-lg border border-rose-200">
                <span class="text-[10px] text-rose-700 block font-semibold">SPOOF REJECTED</span>
                <span class="font-mono font-bold text-rose-900 text-sm">${spoofCount}</span>
              </div>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn-secondary text-xs" onclick="App.closeModal()">Continue Reviewing</button>
          <button type="button" class="btn-primary text-xs" id="btn-confirm-finalize" onclick="CaptureView.confirmFinalize(${sessionId})">
            <i data-lucide="check" class="w-3.5 h-3.5"></i> Save & Finalize Attendance
          </button>
        </div>
      </div>
    `;

    App.showModal(html, false);
    if (window.lucide) window.lucide.createIcons();
  },

  async confirmFinalize(sessionId) {
    const btn = document.getElementById("btn-confirm-finalize");
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = `<span class="spinner-sm mr-2"></span> Finalizing...`;
    }

    App.closeModal();
    App.showToast("Attendance session finalized and permanently saved!", "success");
    if (window.ReportsView) {
      window.ReportsView.currentReportData = null;
    }
    App.navigate("review");
  },

  recaptureImages() {
    this.capturedClassroomSnaps = [];
    this.uploadedFiles = [];

    const fileInput = document.getElementById("multi-file-input");
    if (fileInput) fileInput.value = "";

    const uploadStrip = document.getElementById("upload-preview-strip");
    if (uploadStrip) {
      uploadStrip.innerHTML = "";
      uploadStrip.classList.add("hidden");
    }

    const camStrip = document.getElementById("cam-snap-strip");
    if (camStrip) camStrip.innerHTML = "";

    const counter = document.getElementById("cam-snap-counter");
    if (counter) counter.textContent = "0 Angles Snapped";

    const resultsBox = document.getElementById("multi-attendance-results");
    if (resultsBox) resultsBox.classList.add("hidden");

    const capForm = document.getElementById("multi-capture-form");
    if (capForm && typeof capForm.scrollIntoView === 'function') {
      capForm.scrollIntoView({ behavior: "smooth" });
    }
    App.showToast("Ready for re-capture. Select or snap new classroom images.", "info");
  },

  switchPhoto(index) {
    if (!this.processedResult) return;
    this.activePhotoIndex = index;
    this.resetZoom();

    let photoUrls = [];
    if (this.processedResult.processed_photo_paths && this.processedResult.processed_photo_paths.length > 0) {
      photoUrls = this.processedResult.processed_photo_paths.map(p => {
        const filename = p.split(/[\/\\]/).pop();
        return `/uploads/sessions/${filename}`;
      });
    } else if (this.processedResult.processed_photo_path) {
      const filename = this.processedResult.processed_photo_path.split(/[\/\\]/).pop();
      photoUrls = [`/uploads/sessions/${filename}`];
    }

    const img = document.getElementById("active-classroom-photo");
    if (img && photoUrls[index]) {
      img.src = photoUrls[index];
    }

    document.querySelectorAll(".angle-tab-btn").forEach((btn, idx) => {
      btn.classList.toggle("active", idx === index);
    });
  },

  setGalleryMode(mode) {
    this.galleryMode = mode;
    const focusBox = document.getElementById("focus-photo-box");
    const gridBox = document.getElementById("grid-photo-box");
    const btnFocus = document.getElementById("btn-view-focus");
    const btnGrid = document.getElementById("btn-view-grid");
    const zoomControls = document.getElementById("photo-zoom-controls");

    if (mode === "focus") {
      focusBox?.classList.remove("hidden");
      gridBox?.classList.add("hidden");
      btnFocus?.classList.add("active");
      btnGrid?.classList.remove("active");
      zoomControls?.classList.remove("hidden");
    } else if (mode === "grid") {
      focusBox?.classList.add("hidden");
      gridBox?.classList.remove("hidden");
      btnFocus?.classList.remove("active");
      btnGrid?.classList.add("active");
      zoomControls?.classList.add("hidden");
    }
  },

  adjustZoom(delta) {
    this.currentZoom = Math.min(3.0, Math.max(0.5, this.currentZoom + delta));
    const wrapper = document.getElementById("image-zoom-wrapper");
    const text = document.getElementById("zoom-level-text");
    if (wrapper) {
      wrapper.style.transform = `scale(${this.currentZoom})`;
    }
    if (text) {
      text.textContent = `${Math.round(this.currentZoom * 100)}%`;
    }
  },

  resetZoom() {
    this.currentZoom = 1.0;
    const wrapper = document.getElementById("image-zoom-wrapper");
    const text = document.getElementById("zoom-level-text");
    if (wrapper) {
      wrapper.style.transform = `scale(1.0)`;
    }
    if (text) {
      text.textContent = "100%";
    }
  },

  openEnrollModal(unknownId, cropUrl) {
    const html = `
      <div class="modal-card" style="max-width: 440px;">
        <div class="modal-header">
          <span class="modal-title">Attach Face to Student</span>
          <button class="btn-icon" onclick="App.closeModal()"><i data-lucide="x"></i></button>
        </div>
        <div class="modal-body space-y-4">
          <div class="flex items-center gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl">
            <div class="w-14 h-14 rounded-lg overflow-hidden border border-slate-200 bg-white flex-shrink-0">
              <img src="${cropUrl}" alt="Face #${unknownId}" style="width: 100%; height: 100%; object-fit: cover;" onerror="this.src='/images/placeholder_avatar.jpg'" />
            </div>
            <div>
              <span class="font-bold text-slate-900 text-xs block">Unidentified Face #${unknownId}</span>
              <span class="text-[11px] text-slate-500">Link this face crop to an existing student</span>
            </div>
          </div>

          <div class="p-3 bg-indigo-50 border border-indigo-100 rounded-xl flex items-center justify-between gap-2">
            <div>
              <span class="text-xs font-bold text-indigo-950 block">Student not registered yet?</span>
              <span class="text-[11px] text-indigo-700">Register new profile with this face pre-attached.</span>
            </div>
            <button type="button" class="btn-primary text-xs py-1.5 px-3 flex-shrink-0" onclick="App.closeModal(); App.navigate('student_new', { unknownFaceId: ${unknownId}, cropUrl: '${cropUrl}', sessionId: ${this.currentSession?.id || 'null'}, sessionName: '${(this.currentSession?.name || '').replace(/'/g, "\\'")}' })">
              <i data-lucide="user-plus" class="w-3.5 h-3.5"></i> Register
            </button>
          </div>

          <div>
            <label class="form-label text-xs">Or Search Existing Registered Student</label>
            <input type="text" class="form-input text-xs" id="enroll-student-search" placeholder="Type name or roll number..." oninput="CaptureView.searchStudentsForEnroll(this.value, ${unknownId})" />
            <div id="enroll-search-results" class="mt-2 space-y-1 max-h-40 overflow-y-auto"></div>
          </div>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn-secondary text-xs" onclick="App.closeModal()">Cancel</button>
        </div>
      </div>
    `;

    App.showModal(html, false);
    if (window.lucide) window.lucide.createIcons();
    setTimeout(() => {
      CaptureView.searchStudentsForEnroll("", unknownId);
    }, 50);
  },

  async searchStudentsForEnroll(query, unknownId) {
    const box = document.getElementById("enroll-search-results");
    if (!box) return;

    try {
      const students = await API.get("/students").catch(() => []);
      const q = (query || "").toLowerCase();
      const filtered = students.filter(s => 
        !q || 
        s.full_name?.toLowerCase().includes(q) || 
        s.roll_number?.toLowerCase().includes(q)
      ).slice(0, 5);

      if (filtered.length === 0) {
        box.innerHTML = `<div class="p-2 text-center text-slate-400 text-xs">No matching students found</div>`;
        return;
      }

      box.innerHTML = filtered.map(s => `
        <div class="flex items-center justify-between p-2 hover:bg-slate-100 rounded-lg cursor-pointer border border-transparent hover:border-slate-200 transition-all" onclick="CaptureView.linkStudentToUnknown(${unknownId}, ${s.id}, '${s.full_name}')">
          <div>
            <span class="font-bold text-slate-900 text-xs block">${s.full_name}</span>
            <span class="text-[10px] text-slate-500 font-mono">${s.roll_number} &bull; ${s.program || ''} Sem ${s.semester || ''} Div ${s.section || 'A'}</span>
          </div>
          <button type="button" class="btn-primary text-[10px] py-1 px-2.5">
            Link Face
          </button>
        </div>
      `).join("");

    } catch (e) {
      box.innerHTML = `<div class="p-2 text-center text-rose-500 text-xs">Failed to search students</div>`;
    }
  },

  async linkStudentToUnknown(unknownId, studentId, studentName) {
    try {
      await API.post(`/unknown-faces/${unknownId}/resolve`, {
        student_id: parseInt(studentId),
        update_attendance: true
      });

      App.closeModal();
      App.showToast(`Face attached to ${studentName} and marked Present!`, "success");

      // Refresh session data
      if (this.processedResult && this.processedResult.id) {
        const refreshed = await API.get(`/sessions/${this.processedResult.id}`);
        this.renderResults(refreshed);
      }
    } catch (e) {
      App.showToast(e.message || "Failed to link face", "error");
    }
  },

  async dismissUnknown(unknownId) {
    try {
      await API.post(`/unknown-faces/${unknownId}/dismiss`);
      App.showToast(`Face #${unknownId} dismissed`, "info");
      
      const card = document.getElementById(`card-unk-${unknownId}`);
      if (card) {
        card.style.opacity = "0.3";
        card.style.pointerEvents = "none";
      }
    } catch (e) {
      App.showToast(e.message || "Failed to dismiss face", "error");
    }
  },

  openQuickSnapModal(sessionId, studentId, studentName, recordId) {
    const html = `
      <div class="modal-card" style="max-width: 460px; width: 100%; border-radius: 16px; overflow: hidden; background: #ffffff; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.2);">
        
        <!-- Modal Header -->
        <div class="modal-header" style="padding: 16px 20px; border-bottom: 1px solid #f1f5f9; display: flex; align-items: center; justify-content: space-between;">
          <div style="display: flex; align-items: center; gap: 10px;">
            <div style="width: 32px; height: 32px; border-radius: 8px; background: #eef2ff; color: #4f46e5; display: flex; align-items: center; justify-content: center;">
              <i data-lucide="scan-face" style="width: 18px; height: 18px;"></i>
            </div>
            <div>
              <span class="modal-title" style="font-size: 0.9rem; font-weight: 800; color: #0f172a; display: block; line-height: 1.2;">Live Biometric Verification</span>
              <span style="font-size: 0.72rem; color: #64748b;">Instant facial verification against enrolled 512-D vector</span>
            </div>
          </div>
          <button class="btn-icon" style="color: #94a3b8;" onclick="CaptureView.closeQuickSnapModal()"><i data-lucide="x" style="width: 16px; height: 16px;"></i></button>
        </div>

        <!-- Modal Body -->
        <div class="modal-body" style="padding: 20px; display: flex; flex-direction: column; gap: 12px;">
          
          <div style="display: flex; align-items: center; justify-content: space-between; background: #f8fafc; padding: 8px 12px; border-radius: 8px; border: 1px solid #e2e8f0;">
            <div style="display: flex; align-items: center; gap: 6px;">
              <span style="font-size: 0.72rem; color: #64748b; font-weight: 600;">Candidate:</span>
              <span style="font-size: 0.8rem; font-weight: 800; color: #0f172a;">${studentName}</span>
            </div>
            <span class="badge badge-neutral" style="font-size: 0.68rem; font-weight: 700;">ID #${studentId}</span>
          </div>

          <div class="camera-feed-container" style="min-height: 220px; max-height: 250px; border-radius: 12px; overflow: hidden; background: #020617; position: relative; border: 2px solid rgba(99, 102, 241, 0.25);">
            <video id="quicksnap-video" autoplay playsinline style="width: 100%; height: 100%; object-fit: cover;"></video>
            <div style="position: absolute; inset: 0; pointer-events: none; border: 2px dashed rgba(255, 255, 255, 0.3); margin: 16px; border-radius: 10px;"></div>
          </div>

          <div style="display: flex; align-items: center; justify-content: space-between; font-size: 0.72rem; color: #64748b;">
            <span style="display: flex; align-items: center; gap: 4px;">
              <i data-lucide="camera" style="width: 13px; height: 13px; color: #4f46e5;"></i>
              <span>Direct face toward the webcam</span>
            </span>
            <span class="font-mono text-emerald-600 font-bold" style="background: #ecfdf5; padding: 2px 6px; border-radius: 4px; border: 1px solid #a7f3d0;">
              ArcFace 512-D
            </span>
          </div>

          <!-- In-Modal Feedback Status Banner -->
          <div id="quicksnap-feedback-banner" style="display: none;"></div>

        </div>

        <!-- Modal Footer -->
        <div class="modal-footer" style="padding: 14px 20px; background: #f8fafc; border-top: 1px solid #f1f5f9; display: flex; align-items: center; justify-content: flex-end; gap: 8px;">
          <button type="button" class="btn-secondary text-xs" style="font-weight: 600;" onclick="CaptureView.closeQuickSnapModal()">Cancel</button>
          <button type="button" class="btn-primary text-xs" style="font-weight: 700; display: inline-flex; align-items: center; gap: 6px;" id="btn-quicksnap-verify" onclick="CaptureView.executeQuickSnapVerify(${sessionId}, ${studentId}, ${recordId}, '${studentName.replace(/'/g, "\\'")}')">
            <i data-lucide="camera" style="width: 14px; height: 14px;"></i>
            <span>Verify & Mark Present</span>
          </button>
        </div>

      </div>
    `;

    App.showModal(html, false);
    if (window.lucide) window.lucide.createIcons();
    this.startQuickSnapCamera();
  },

  async startQuickSnapCamera() {
    const video = document.getElementById("quicksnap-video");
    if (!video) return;
    try {
      this.quickSnapStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" } });
      video.srcObject = this.quickSnapStream;
    } catch (e) {
      const banner = document.getElementById("quicksnap-feedback-banner");
      if (banner) {
        banner.style.display = "block";
        banner.innerHTML = `
          <div style="background: #fffbeb; border: 1px solid #fde68a; border-radius: 10px; padding: 12px; display: flex; align-items: flex-start; gap: 10px; color: #92400e; font-size: 0.75rem;">
            <i data-lucide="alert-triangle" style="width: 18px; height: 18px; color: #d97706; flex-shrink: 0;"></i>
            <span>Camera permission required. Please allow browser camera access.</span>
          </div>
        `;
        if (window.lucide) window.lucide.createIcons();
      }
    }
  },

  closeQuickSnapModal() {
    if (this.quickSnapStream) {
      this.quickSnapStream.getTracks().forEach(t => t.stop());
      this.quickSnapStream = null;
    }
    App.closeModal();
  },

  async executeQuickSnapVerify(sessionId, studentId, recordId, studentName = "Student") {
    const video = document.getElementById("quicksnap-video");
    const banner = document.getElementById("quicksnap-feedback-banner");

    if (!video || !video.videoWidth) {
      if (banner) {
        banner.style.display = "block";
        banner.innerHTML = `
          <div style="background: #fffbeb; border: 1px solid #fde68a; border-radius: 10px; padding: 10px; color: #92400e; font-size: 0.75rem;">
            Webcam stream is initializing. Please wait a moment and try again.
          </div>
        `;
      }
      return;
    }

    if (banner) {
      banner.style.display = "none";
      banner.innerHTML = "";
    }

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(video, 0, 0);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.96);

    const btn = document.getElementById("btn-quicksnap-verify");
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = `<span class="spinner-sm mr-2"></span> Verifying Biometrics...`;
    }

    try {
      const res = await API.post("/attendance/quick-verify", {
        session_id: sessionId,
        student_id: studentId,
        snapshot_data: dataUrl
      });

      // Show in-modal success feedback
      if (banner) {
        banner.style.display = "block";
        banner.innerHTML = `
          <div style="background: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 10px; padding: 12px; display: flex; align-items: flex-start; gap: 10px; color: #065f46; font-size: 0.75rem; line-height: 1.4;">
            <i data-lucide="check-circle-2" style="width: 18px; height: 18px; color: #059669; flex-shrink: 0; margin-top: 1px;"></i>
            <div style="flex: 1;">
              <strong style="display: block; font-size: 0.8rem; color: #065f46; margin-bottom: 2px;">Biometric Match Confirmed (${res.confidence_score}%)</strong>
              <span>${studentName} verified successfully! Marked as <strong style="color: #059669;">PRESENT</strong>.</span>
            </div>
          </div>
        `;
        if (window.lucide) window.lucide.createIcons();
      }

      App.showToast(`Biometric match confirmed (${res.confidence_score}%)! Marked Present.`, "success");

      // Update in local memory
      if (this.processedResult && this.processedResult.records) {
        const rec = this.processedResult.records.find(r => r.id === recordId || r.student_id === studentId);
        if (rec) {
          rec.status = "PRESENT";
          rec.confidence_score = res.confidence_score;
          rec.verification_type = "LIVE_BIOMETRIC_VERIFIED";
        }
      }

      setTimeout(() => {
        this.closeQuickSnapModal();
        if (this.processedResult) {
          this.renderResults(this.processedResult);
        }
      }, 1200);

    } catch (err) {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = `<i data-lucide="refresh-cw" style="width: 14px; height: 14px;"></i><span>Retry Verification</span>`;
        if (window.lucide) window.lucide.createIcons();
      }

      // Show clear in-modal error banner
      if (banner) {
        banner.style.display = "block";
        banner.innerHTML = `
          <div style="background: #fff1f2; border: 1px solid #fecdd3; border-radius: 10px; padding: 12px; display: flex; align-items: flex-start; gap: 10px; color: #9f1239; font-size: 0.75rem; line-height: 1.4;">
            <i data-lucide="alert-circle" style="width: 18px; height: 18px; color: #e11d48; flex-shrink: 0; margin-top: 1px;"></i>
            <div style="flex: 1;">
              <strong style="display: block; font-size: 0.8rem; color: #9f1239; margin-bottom: 2px;">Biometric Verification Failed</strong>
              <span>${err.message || 'Face does not match the enrolled biometric profile for this student. Attendance was not marked.'}</span>
            </div>
          </div>
        `;
        if (window.lucide) window.lucide.createIcons();
      }

      App.showToast(err.message || "Biometric mismatch or verification failed.", "error");
    }
  }
};

window.CaptureView = CaptureView;
