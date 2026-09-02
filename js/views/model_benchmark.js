// ===================================================================
// VisionAttend - Computer Vision & Biometric Benchmark Telemetry
// File: frontend/js/views/model_benchmark.js
// ===================================================================

const ModelBenchmarkView = {
  async render(container) {
    container.innerHTML = `
      <div class="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h2 class="text-xl font-bold text-slate-900">Computer Vision & Biometric Benchmarks</h2>
          <p class="text-xs text-slate-500 mt-0.5">Empirical comparison of computer vision detection & facial recognition architectures</p>
        </div>
      </div>

      <div id="benchmark-data-container">
        <div class="glass-panel text-center py-16 text-slate-500"><span class="spinner-sm mr-2"></span> Loading AI model telemetry...</div>
      </div>
    `;

    if (window.lucide) window.lucide.createIcons();
    await this.loadMetrics();
  },

  async loadMetrics() {
    const container = document.getElementById("benchmark-data-container");
    if (!container) return;

    try {
      const data = await API.get("/analytics/model-performance");
      const current = data.current_model_metrics;

      container.innerHTML = `
        <!-- Active Pipeline Architectural Banner -->
        <div class="p-3.5 mb-6 rounded-xl bg-indigo-50 border border-indigo-200 text-xs text-indigo-900 flex items-start gap-3">
          <i data-lucide="info" class="w-4 h-4 text-indigo-600 flex-shrink-0 mt-0.5"></i>
          <div>
            <span class="font-bold block">Active Production Pipeline: YOLOv8-Face (Detection) • MiniFASNetV2 (Anti-Spoofing) • ArcFace 512-D (Recognition)</span>
            <span class="text-indigo-800 text-[11px]">1. <b>YOLOv8-Face</b> detects multi-face locations &rarr; 2. <b>MiniFASNetV2</b> verifies live human presentation (screen & paper attacks rejected immediately) &rarr; 3. <b>ArcFace ResNet-50</b> extracts 512-D unit vectors on live faces for cosine similarity matching.</span>
          </div>
        </div>

        <!-- Active Model Metrics KPI Cards -->
        <div class="kpi-grid mb-6">
          <div class="kpi-card">
            <div class="kpi-header">
              <span class="kpi-title">Recognition Accuracy</span>
              <div class="kpi-icon-wrap" style="background: rgba(16, 185, 129, 0.1); color: #059669;">
                <i data-lucide="award" class="w-5 h-5"></i>
              </div>
            </div>
            <div class="kpi-value text-emerald-600 font-mono">${current.accuracy}%</div>
            <div class="kpi-caption">LFW + Classroom Benchmark</div>
          </div>

          <div class="kpi-card">
            <div class="kpi-header">
              <span class="kpi-title">F1-Score</span>
              <div class="kpi-icon-wrap" style="background: rgba(79, 70, 229, 0.1); color: #4f46e5;">
                <i data-lucide="target" class="w-5 h-5"></i>
              </div>
            </div>
            <div class="kpi-value text-indigo-600 font-mono">${current.f1_score}%</div>
            <div class="kpi-caption">Harmonic Mean (P: ${current.precision}% / R: ${current.recall}%)</div>
          </div>

          <div class="kpi-card">
            <div class="kpi-header">
              <span class="kpi-title">Metric Embeddings</span>
              <div class="kpi-icon-wrap" style="background: rgba(139, 92, 246, 0.1); color: #8b5cf6;">
                <i data-lucide="binary" class="w-5 h-5"></i>
              </div>
            </div>
            <div class="kpi-value font-mono">512-D</div>
            <div class="kpi-caption">ArcFace Angular Hypersphere Vectors</div>
          </div>

          <div class="kpi-card">
            <div class="kpi-header">
              <span class="kpi-title">Inference Latency</span>
              <div class="kpi-icon-wrap" style="background: rgba(245, 158, 11, 0.1); color: #d97706;">
                <i data-lucide="zap" class="w-5 h-5"></i>
              </div>
            </div>
            <div class="kpi-value text-amber-600 font-mono">${current.batch_classroom_latency_sec}s</div>
            <div class="kpi-caption">Full Multi-Face Batch Pipeline</div>
          </div>
        </div>

        <!-- Institutional Biometric Matching Sensitivity & System-Wide Lock -->
        <div class="glass-panel mb-6" style="border-radius: 16px; border: 1px solid rgba(99, 102, 241, 0.2); box-shadow: 0 4px 18px rgba(99, 102, 241, 0.06); background: #ffffff;">
          <div class="panel-header" style="border-bottom: 1px solid #f1f5f9; padding-bottom: 14px; margin-bottom: 16px; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px;">
            <div style="display: flex; align-items: center; gap: 10px;">
              <div style="width: 36px; height: 36px; border-radius: 10px; background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%); color: #ffffff; display: flex; align-items: center; justify-content: center; font-weight: 800; box-shadow: 0 4px 10px rgba(99, 102, 241, 0.25);">
                <i data-lucide="shield-check" style="width: 18px; height: 18px;"></i>
              </div>
              <div>
                <h3 style="font-size: 0.95rem; font-weight: 800; color: #0f172a; margin: 0; line-height: 1.2;">
                  Institutional Biometric Matching Sensitivity (System-Wide Lock)
                </h3>
                <span style="font-size: 0.72rem; color: #64748b; font-weight: 500;">
                  Set & lock the universal ArcFace cosine similarity threshold across all faculty attendance captures
                </span>
              </div>
            </div>

            <div id="sensitivity-lock-status-pill">
              <span class="badge" style="background: #ecfdf5; color: #065f46; border: 1px solid #a7f3d0; font-size: 0.72rem; font-weight: 800; padding: 4px 10px; display: inline-flex; align-items: center; gap: 5px;">
                <i data-lucide="lock" style="width: 13px; height: 13px; color: #059669;"></i>
                <span id="sensitivity-locked-pill-text">System Enforced (0.50)</span>
              </span>
            </div>
          </div>

          <div id="sensitivity-config-content" style="padding: 4px 6px;">
            <!-- Rendered dynamically by ModelBenchmarkView.renderSensitivitySection -->
          </div>
        </div>

        <!-- Library Comparative Matrix -->
        <div class="glass-panel mb-6">
          <div class="panel-header">
            <div>
              <span class="panel-title">
                <i data-lucide="layers" class="w-4 h-4 text-indigo-600"></i>
                Computer Vision Architecture Comparative Matrix
              </span>
              <p class="text-xs text-slate-500 mt-0.5">Benchmarked under variable lighting, pose angles, and classroom occlusions</p>
            </div>
          </div>

          <div class="data-table-container">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Framework / Architecture</th>
                  <th>Detection Acc</th>
                  <th>Recognition Acc</th>
                  <th>Inference FPS</th>
                  <th>Memory (MB)</th>
                  <th>Lighting Robustness</th>
                  <th>Occlusion Tolerance</th>
                  <th>Production Status</th>
                </tr>
              </thead>
              <tbody>
                ${(data.library_comparison || []).map(lib => `
                  <tr class="${lib.status.includes('ACTIVE') ? 'bg-indigo-50/50' : ''}">
                    <td>
                      <div class="font-bold text-slate-900">${lib.library}</div>
                    </td>
                    <td><span class="font-semibold text-slate-800">${lib.detection_accuracy}%</span></td>
                    <td>
                      <span class="font-bold font-mono ${typeof lib.recognition_accuracy === 'number' ? 'text-emerald-600' : 'text-slate-400'}">
                        ${typeof lib.recognition_accuracy === 'number' ? `${lib.recognition_accuracy}%` : lib.recognition_accuracy}
                      </span>
                    </td>
                    <td><span class="font-mono text-xs text-slate-600">${lib.speed_fps} FPS</span></td>
                    <td class="text-slate-600">${lib.memory_mb} MB</td>
                    <td><span class="text-xs ${lib.lighting_robustness.includes('High') ? 'text-emerald-700 font-semibold' : 'text-slate-600'}">${lib.lighting_robustness}</span></td>
                    <td><span class="text-xs ${lib.occlusion_tolerance.includes('High') ? 'text-emerald-700 font-semibold' : 'text-slate-600'}">${lib.occlusion_tolerance}</span></td>
                    <td>
                      <span class="badge ${lib.status.includes('ACTIVE') ? 'badge-present' : 'badge-neutral'} text-[10px]">
                        ${lib.status}
                      </span>
                    </td>
                  </tr>
                `).join("")}
              </tbody>
            </table>
          </div>
        </div>

        <!-- Threshold Calibration Analysis -->
        <div class="glass-panel">
          <div class="panel-header">
            <span class="panel-title">
              <i data-lucide="sliders" class="w-4 h-4 text-purple-600"></i>
              Matching Sensitivity & Threshold Calibration
            </span>
            <span class="text-xs text-slate-500">Calibrated for Minimum False Accept Rate (FAR)</span>
          </div>

          <div class="data-table-container">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Tolerance</th>
                  <th>Profile Label</th>
                  <th>Precision</th>
                  <th>Recall</th>
                  <th>Rejection Rate</th>
                  <th>Recommended Deployment Environment</th>
                </tr>
              </thead>
              <tbody>
                ${(data.threshold_analysis || []).map(th => `
                  <tr class="${th.tolerance === 0.55 ? 'bg-emerald-50/50' : ''}">
                    <td><span class="font-mono font-bold text-indigo-600">${th.tolerance}</span></td>
                    <td class="font-semibold text-slate-900">${th.label}</td>
                    <td class="text-emerald-600 font-semibold font-mono">${th.precision}%</td>
                    <td class="text-indigo-600 font-semibold font-mono">${th.recall}%</td>
                    <td class="text-purple-600 font-semibold font-mono">${th.unknown_rejection}%</td>
                    <td class="text-xs text-slate-600">${th.use_case}</td>
                  </tr>
                `).join("")}
              </tbody>
            </table>
          </div>
        </div>
      `;

      await this.loadSensitivitySection();
      if (window.lucide) window.lucide.createIcons();

    } catch (e) {
      container.innerHTML = `<div class="glass-panel text-center text-rose-600 p-8">Failed to load AI metrics: ${e.message}</div>`;
    }
  },

  isEditUnlocked: false,
  selectedTolerance: 0.50,
  selectedToleranceLabel: "Standard Balanced (0.50 - Recommended)",
  loadedConfig: null,

  async loadSensitivitySection() {
    const container = document.getElementById("sensitivity-config-content");
    if (!container) return;

    try {
      const config = await API.get("/admin/system-settings/matching-sensitivity").catch(() => ({
        tolerance: 0.50,
        label: "Standard Balanced (0.50 - Recommended)",
        updated_by: "System Administrator",
        updated_at: null
      }));

      this.loadedConfig = config;
      const currentTol = parseFloat(config.tolerance || 0.50);
      if (!this.isEditUnlocked) {
        this.selectedTolerance = currentTol;
        this.selectedToleranceLabel = config.label || "Standard Balanced (0.50 - Recommended)";
      }

      const pillContainer = document.getElementById("sensitivity-lock-status-pill");
      if (pillContainer) {
        if (this.isEditUnlocked) {
          pillContainer.innerHTML = `
            <span class="badge" style="background: #fffbeb; color: #b45309; border: 1px solid #fde68a; font-size: 0.72rem; font-weight: 800; padding: 4px 10px; display: inline-flex; align-items: center; gap: 5px;">
              <i data-lucide="unlock" style="width: 13px; height: 13px; color: #d97706;"></i>
              <span>UNLOCKED (Edit Mode Active)</span>
            </span>
          `;
        } else {
          pillContainer.innerHTML = `
            <span class="badge" style="background: #ecfdf5; color: #065f46; border: 1px solid #a7f3d0; font-size: 0.72rem; font-weight: 800; padding: 4px 10px; display: inline-flex; align-items: center; gap: 5px;">
              <i data-lucide="lock" style="width: 13px; height: 13px; color: #059669;"></i>
              <span>LOCKED at ${currentTol.toFixed(2)} (${config.label || 'Standard Balanced'})</span>
            </span>
          `;
        }
      }

      const isUnlocked = this.isEditUnlocked;

      container.innerHTML = `
        <!-- Top Status Banner -->
        <div style="background: ${isUnlocked ? '#fffbeb' : '#f8fafc'}; border: 1px solid ${isUnlocked ? '#fde68a' : '#e2e8f0'}; border-radius: 12px; padding: 14px 16px; margin-bottom: 16px; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px;">
          <div style="display: flex; align-items: center; gap: 12px;">
            <div style="width: 38px; height: 38px; border-radius: 10px; background: ${isUnlocked ? '#fef3c7' : '#e0e7ff'}; color: ${isUnlocked ? '#d97706' : '#4f46e5'}; display: flex; align-items: center; justify-content: center; font-weight: 800;">
              <i data-lucide="${isUnlocked ? 'unlock' : 'lock'}" style="width: 18px; height: 18px;"></i>
            </div>
            <div>
              <div style="font-size: 0.88rem; font-weight: 800; color: #0f172a;">
                ${isUnlocked 
                  ? `<span style="color: #b45309;">Editing System Biometric Sensitivity</span>` 
                  : `Active Institutional Setting: <span class="font-mono text-indigo-600">${currentTol.toFixed(2)}</span> (${config.label || 'Standard Balanced'})`
                }
              </div>
              <div style="font-size: 0.72rem; color: #64748b; margin-top: 2px;">
                ${isUnlocked 
                  ? 'Select one of the calibrated profiles below or enter a custom threshold, then click "Lock & Save".' 
                  : `Universal institutional policy locked by Administrator. All faculty attendance captures automatically use this threshold.`
                }
                ${config.updated_at && !isUnlocked ? `<span class="text-slate-400 block mt-0.5">Last locked: ${(window.DateTimeUtils || window.DateUtils) ? (window.DateTimeUtils || window.DateUtils).formatDateTime(config.updated_at) : config.updated_at} by ${config.updated_by}</span>` : ''}
              </div>
            </div>
          </div>

          <!-- Top Action Button -->
          <div>
            ${!isUnlocked ? `
              <button type="button" class="btn-primary text-xs font-bold py-2 px-5" style="border-radius: 10px; background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%); box-shadow: 0 4px 12px rgba(99, 102, 241, 0.25); display: inline-flex; align-items: center; gap: 6px;" onclick="ModelBenchmarkView.unlockSensitivity()">
                <i data-lucide="unlock" class="w-3.5 h-3.5"></i>
                <span>Unlock to Modify Sensitivity</span>
              </button>
            ` : `
              <div style="display: flex; align-items: center; gap: 8px;">
                <button type="button" class="btn-secondary text-xs font-bold py-2 px-4" style="border-radius: 10px;" onclick="ModelBenchmarkView.cancelSensitivityEdit()">
                  Cancel
                </button>
                <button type="button" id="btn-save-sensitivity-lock" class="btn-primary text-xs font-bold py-2 px-5" style="border-radius: 10px; background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%); box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3); display: inline-flex; align-items: center; gap: 6px;" onclick="ModelBenchmarkView.saveSensitivityLock()">
                  <i data-lucide="lock" class="w-3.5 h-3.5"></i>
                  <span>Lock & Save Threshold</span>
                </button>
              </div>
            `}
          </div>
        </div>

        <!-- 4 Sensitivity Choice Cards -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 12px; margin-bottom: 14px;">
          
          <!-- Option 1: Standard Balanced -->
          <div class="sensitivity-option-card ${this.selectedTolerance === 0.50 ? 'selected' : ''}" style="border: 2px solid ${this.selectedTolerance === 0.50 ? '#6366f1' : '#e2e8f0'}; background: ${this.selectedTolerance === 0.50 ? '#eef2ff' : '#ffffff'}; border-radius: 12px; padding: 14px; cursor: ${isUnlocked ? 'pointer' : 'default'}; opacity: ${isUnlocked || this.selectedTolerance === 0.50 ? '1' : '0.6'}; display: flex; flex-direction: column; gap: 6px; transition: all 0.15s ease;" onclick="${isUnlocked ? "ModelBenchmarkView.onSensitivityOptionSelected(0.50, 'Standard Balanced (0.50 - Recommended)')" : ''}">
            <div style="display: flex; align-items: center; justify-content: space-between;">
              <span style="font-size: 0.82rem; font-weight: 800; color: #0f172a;">Standard Balanced</span>
              ${this.selectedTolerance === 0.50 ? `<span class="badge" style="background: #e0e7ff; color: #4338ca; font-size: 0.65rem; font-weight: 800;">ACTIVE</span>` : ''}
            </div>
            <span class="font-mono text-xs font-bold text-indigo-600">Threshold: 0.50 (Recommended)</span>
            <p style="font-size: 0.72rem; color: #64748b; margin: 0; line-height: 1.3;">Optimal balance of high accuracy (99.2%) with standard classroom lighting conditions.</p>
          </div>

          <!-- Option 2: Strict High Security -->
          <div class="sensitivity-option-card ${this.selectedTolerance === 0.58 ? 'selected' : ''}" style="border: 2px solid ${this.selectedTolerance === 0.58 ? '#6366f1' : '#e2e8f0'}; background: ${this.selectedTolerance === 0.58 ? '#eef2ff' : '#ffffff'}; border-radius: 12px; padding: 14px; cursor: ${isUnlocked ? 'pointer' : 'default'}; opacity: ${isUnlocked || this.selectedTolerance === 0.58 ? '1' : '0.6'}; display: flex; flex-direction: column; gap: 6px; transition: all 0.15s ease;" onclick="${isUnlocked ? "ModelBenchmarkView.onSensitivityOptionSelected(0.58, 'Strict High Security (0.58)')" : ''}">
            <div style="display: flex; align-items: center; justify-content: space-between;">
              <span style="font-size: 0.82rem; font-weight: 800; color: #0f172a;">Strict High Security</span>
              ${this.selectedTolerance === 0.58 ? `<span class="badge" style="background: #ecfdf5; color: #065f46; font-size: 0.65rem; font-weight: 800;">ACTIVE</span>` : ''}
            </div>
            <span class="font-mono text-xs font-bold text-emerald-600">Threshold: 0.58 (Zero-False-Positive)</span>
            <p style="font-size: 0.72rem; color: #64748b; margin: 0; line-height: 1.3;">Requires high facial similarity. Excellent for examination halls and high-stakes sessions.</p>
          </div>

          <!-- Option 3: Flexible / Low Light -->
          <div class="sensitivity-option-card ${this.selectedTolerance === 0.42 ? 'selected' : ''}" style="border: 2px solid ${this.selectedTolerance === 0.42 ? '#6366f1' : '#e2e8f0'}; background: ${this.selectedTolerance === 0.42 ? '#eef2ff' : '#ffffff'}; border-radius: 12px; padding: 14px; cursor: ${isUnlocked ? 'pointer' : 'default'}; opacity: ${isUnlocked || this.selectedTolerance === 0.42 ? '1' : '0.6'}; display: flex; flex-direction: column; gap: 6px; transition: all 0.15s ease;" onclick="${isUnlocked ? "ModelBenchmarkView.onSensitivityOptionSelected(0.42, 'Flexible / Low Light (0.42)')" : ''}">
            <div style="display: flex; align-items: center; justify-content: space-between;">
              <span style="font-size: 0.82rem; font-weight: 800; color: #0f172a;">Flexible / Low Light</span>
              ${this.selectedTolerance === 0.42 ? `<span class="badge" style="background: #fffbeb; color: #b45309; font-size: 0.65rem; font-weight: 800;">ACTIVE</span>` : ''}
            </div>
            <span class="font-mono text-xs font-bold text-amber-600">Threshold: 0.42 (High Tolerance)</span>
            <p style="font-size: 0.72rem; color: #64748b; margin: 0; line-height: 1.3;">Tolerant to off-angle classroom cameras, back-row shadows, and dim projector lighting.</p>
          </div>

          <!-- Option 4: Custom Threshold -->
          <div style="border: 2px solid ${(![0.50, 0.58, 0.42].includes(this.selectedTolerance)) ? '#6366f1' : '#e2e8f0'}; background: ${(![0.50, 0.58, 0.42].includes(this.selectedTolerance)) ? '#eef2ff' : '#ffffff'}; border-radius: 12px; padding: 14px; opacity: ${isUnlocked || ![0.50, 0.58, 0.42].includes(this.selectedTolerance) ? '1' : '0.6'}; display: flex; flex-direction: column; gap: 6px;">
            <div style="display: flex; align-items: center; justify-content: space-between;">
              <span style="font-size: 0.82rem; font-weight: 800; color: #0f172a;">Custom Threshold</span>
              ${(![0.50, 0.58, 0.42].includes(this.selectedTolerance)) ? `<span class="badge" style="background: #e0e7ff; color: #4338ca; font-size: 0.65rem; font-weight: 800;">ACTIVE</span>` : ''}
            </div>
            <div style="display: flex; align-items: center; gap: 8px; margin-top: 2px;">
              <input type="number" id="admin-custom-tolerance-input" min="0.20" max="0.90" step="0.01" value="${this.selectedTolerance.toFixed(2)}" class="form-input text-xs font-mono font-bold" style="height: 34px; border-radius: 8px; width: 100px; background: #ffffff;" ${!isUnlocked ? 'disabled' : ''} oninput="ModelBenchmarkView.onCustomToleranceInput(this.value)" />
              <span class="text-xs text-slate-500 font-medium">(0.20 – 0.90)</span>
            </div>
            <p style="font-size: 0.70rem; color: #64748b; margin: 0;">Specify a custom ArcFace angular cutoff.</p>
          </div>

        </div>
      `;

      if (window.lucide) window.lucide.createIcons();

    } catch (e) {
      console.warn("Failed to load sensitivity section:", e);
    }
  },

  unlockSensitivity() {
    this.isEditUnlocked = true;
    this.loadSensitivitySection();
  },

  cancelSensitivityEdit() {
    this.isEditUnlocked = false;
    if (this.loadedConfig) {
      this.selectedTolerance = parseFloat(this.loadedConfig.tolerance || 0.50);
      this.selectedToleranceLabel = this.loadedConfig.label || "Standard Balanced (0.50 - Recommended)";
    }
    this.loadSensitivitySection();
  },

  onSensitivityOptionSelected(tolerance, label) {
    this.selectedTolerance = tolerance;
    this.selectedToleranceLabel = label;
    const customInput = document.getElementById("admin-custom-tolerance-input");
    if (customInput) customInput.value = tolerance.toFixed(2);
    this.loadSensitivitySection();
  },

  onCustomToleranceInput(val) {
    const num = parseFloat(val);
    if (!isNaN(num) && num >= 0.20 && num <= 0.90) {
      this.selectedTolerance = num;
      this.selectedToleranceLabel = `Custom Threshold (${num.toFixed(2)})`;
      document.querySelectorAll(".sensitivity-option-card").forEach(card => {
        card.style.borderColor = "#e2e8f0";
        card.style.background = "#ffffff";
      });
    }
  },

  async saveSensitivityLock() {
    const btn = document.getElementById("btn-save-sensitivity-lock");
    if (btn) btn.disabled = true;

    try {
      const res = await API.post("/admin/system-settings/matching-sensitivity", {
        tolerance: this.selectedTolerance,
        label: this.selectedToleranceLabel
      });

      this.isEditUnlocked = false;
      App.showToast(`🔒 Institutional Biometric Sensitivity locked at ${res.tolerance.toFixed(2)} (${res.label}) across entire system!`, "success");
      await this.loadSensitivitySection();
    } catch (e) {
      App.showToast(`Failed to lock sensitivity: ${e.message}`, "error");
    } finally {
      if (btn) btn.disabled = false;
    }
  }
};

window.ModelBenchmarkView = ModelBenchmarkView;
