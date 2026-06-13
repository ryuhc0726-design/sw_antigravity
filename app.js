// Global Application State
let readingLogs = [];
let activeTab = 'tab-dashboard';
let activeChartType = 'week'; // 'week' or 'month'
let currentCsvPath = '';
let autoSaveTimer = null;

// DOM Elements
const elements = {
  // Navigation Tabs
  tabBtns: {
    dashboard: document.getElementById('tab-btn-dashboard'),
    logs: document.getElementById('tab-btn-logs'),
    report: document.getElementById('tab-btn-report')
  },
  panes: {
    dashboard: document.getElementById('tab-dashboard'),
    logs: document.getElementById('tab-logs'),
    report: document.getElementById('tab-report')
  },
  
  // CSV path footer
  csvPath: document.getElementById('csv-file-path'),
  
  // Dashboard elements
  statTotalBooks: document.getElementById('stat-total-books'),
  statTotalPages: document.getElementById('stat-total-pages'),
  statMonthBooks: document.getElementById('stat-month-books'),
  statWeekBooks: document.getElementById('stat-week-books'),
  btnChartWeek: document.getElementById('btn-chart-week'),
  btnChartMonth: document.getElementById('btn-chart-month'),
  statsChart: document.getElementById('stats-chart'),
  chartTooltip: document.getElementById('chart-tooltip'),
  
  // Logs list elements
  logSearchInput: document.getElementById('log-search-input'),
  logsTableBody: document.getElementById('logs-table-body'),
  btnOpenAddModal: document.getElementById('btn-open-add-modal'),
  
  // Modal elements
  logModal: document.getElementById('log-modal'),
  modalTitle: document.getElementById('modal-title'),
  btnCloseModal: document.getElementById('btn-close-modal'),
  btnCancelModal: document.getElementById('btn-cancel-modal'),
  logForm: document.getElementById('log-form'),
  editIndex: document.getElementById('edit-index'),
  inputTitle: document.getElementById('input-title'),
  inputAuthor: document.getElementById('input-author'),
  inputDate: document.getElementById('input-date'),
  inputPages: document.getElementById('input-pages'),
  
  // Report Editor elements
  reportBookSelect: document.getElementById('report-book-select'),
  reportEditorBox: document.getElementById('report-editor-box'),
  reportEmptyBox: document.getElementById('report-empty-box'),
  reportBookTitle: document.getElementById('report-book-title'),
  reportBookAuthor: document.getElementById('report-book-author'),
  reportBookDate: document.getElementById('report-book-date'),
  reportBookPages: document.getElementById('report-book-pages'),
  reportTextarea: document.getElementById('report-textarea'),
  btnSaveReport: document.getElementById('btn-save-report'),
  saveStatus: document.getElementById('save-status')
};

// --- INITIALIZATION ---
//  수정 후: 순서 변경
document.addEventListener('DOMContentLoaded', () => {
  loadData();            // 1. 저장된 데이터를 LocalStorage에서 먼저 로드 (가장 중요!)
  setDefaultDate();      // 2. 기본 날짜 세팅
  setupEventListeners(); // 3. 그 다음 이벤트 리스너 연결
  refreshUI();           // 4. 마지막으로 화면 그리기
});

//  수정 후
// 웹 브라우저 저장소 안내 문구 표시
function loadCsvPath() {
  if (elements.csvPath) {
    elements.csvPath.textContent = "웹 브라우저 LocalStorage 사용 중";
    elements.csvPath.title = "GitHub Pages 배포 환경";
  }
}

// Set default date picker to today in Local Timezone
function setDefaultDate() {
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');
  elements.inputDate.value = `${yyyy}-${mm}-${dd}`;
}

// --- IPC & DATA TRANSFERS ---

// Read and Parse CSV Data
function loadData() {
  const savedData = localStorage.getItem('readingLogs');

  if (savedData) {
    readingLogs = JSON.parse(savedData);
  } else {
    readingLogs = [];
  }
}

// Write to CSV Data
async function saveData() {
  localStorage.setItem(
    'readingLogs',
    JSON.stringify(readingLogs)
  );

  return true;
}

// Robust RFC 4180 CSV parser
function parseCSV(text) {
  // Remove BOM if present
  let cleanText = text;
  if (cleanText.startsWith('\uFEFF')) {
    cleanText = cleanText.substring(1);
  }
  
  const parsedRows = [];
  let row = [''];
  let inQuotes = false;
  
  for (let i = 0; i < cleanText.length; i++) {
    const char = cleanText[i];
    const nextChar = cleanText[i + 1];
    
    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        row[row.length - 1] += '"';
        i++; // skip next quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      row.push('');
    } else if ((char === '\r' || char === '\n') && !inQuotes) {
      if (char === '\r' && nextChar === '\n') {
        i++; // Skip carriage return newline pairing
      }
      parsedRows.push(row);
      row = [''];
    } else {
      row[row.length - 1] += char;
    }
  }
  
  // Push final line if not empty
  if (row.length > 1 || row[0] !== '') {
    parsedRows.push(row);
  }
  
  if (parsedRows.length <= 1) return []; // Only header or empty
  
  const header = parsedRows[0].map(h => h.trim());
  const logs = [];
  
  for (let i = 1; i < parsedRows.length; i++) {
    const item = parsedRows[i];
    if (item.length < 4) continue; // Skip malformed rows
    
    logs.push({
      title: item[0] || '',
      author: item[1] || '',
      date: item[2] || '',
      pages: parseInt(item[3]) || 0,
      review: item[4] || ''
    });
  }
  
  // Sort logs by date descending by default
  return logs.sort((a, b) => new Date(b.date) - new Date(a.date));
}

// CSV Stringifier
function stringifyCSV(logs) {
  const header = ['제목', '저자', '읽은날짜', '읽은쪽수', '감상문'];
  
  // Sort chronologically ascending for standard file layout
  const sortedLogs = [...logs].sort((a, b) => new Date(a.date) - new Date(b.date));
  
  const rows = [header];
  for (const log of sortedLogs) {
    rows.push([
      log.title,
      log.author,
      log.date,
      String(log.pages),
      log.review || ''
    ]);
  }
  
  return rows.map(row => 
    row.map(val => {
      // Escape quotes and wrap values containing commas/newlines/quotes
      const escaped = val.replace(/"/g, '""');
      if (escaped.includes(',') || escaped.includes('\n') || escaped.includes('\r') || escaped.includes('"')) {
        return `"${escaped}"`;
      }
      return escaped;
    }).join(',')
  ).join('\n') + '\n';
}

// --- UI REFRESH & NAVIGATION ---

function refreshUI() {
  renderStats();
  renderLogs();
  renderChart();
  updateReportSelector();
}

// Tab Swapper
function switchTab(tabId) {
  activeTab = tabId;
  
  // Toggle nav buttons
  Object.keys(elements.tabBtns).forEach(key => {
    const btn = elements.tabBtns[key];
    if (btn.dataset.target === tabId) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });
  
  // Toggle panels
  Object.keys(elements.panes).forEach(key => {
    const pane = elements.panes[key];
    if (pane.id === tabId) {
      pane.classList.add('active');
    } else {
      pane.classList.remove('active');
    }
  });
  
  // Reload and recalculate when switching tabs
  if (tabId === 'tab-dashboard') {
    renderChart();
  } else if (tabId === 'tab-report') {
    updateReportSelector();
  }
}

// --- STATS CALCULATION ---
function renderStats() {
  const totalBooks = readingLogs.length;
  let totalPages = 0;
  let monthBooksCount = 0;
  let weekBooksCount = 0;
  
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth(); // 0-11
  
  // 7 days ago limit
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(now.getDate() - 7);
  sevenDaysAgo.setHours(0, 0, 0, 0);
  
  readingLogs.forEach(log => {
    totalPages += log.pages;
    
    // Parse read date
    const [y, m, d] = log.date.split('-').map(Number);
    const logDate = new Date(y, m - 1, d);
    
    // Check if current calendar month
    if (y === currentYear && (m - 1) === currentMonth) {
      monthBooksCount++;
    }
    
    // Check if within last 7 days (including today)
    if (logDate >= sevenDaysAgo) {
      weekBooksCount++;
    }
  });
  
  elements.statTotalBooks.innerHTML = `${totalBooks} <span class="unit">권</span>`;
  elements.statTotalPages.innerHTML = `${totalPages.toLocaleString()} <span class="unit">쪽</span>`;
  elements.statMonthBooks.innerHTML = `${monthBooksCount} <span class="unit">권</span>`;
  elements.statWeekBooks.innerHTML = `${weekBooksCount} <span class="unit">권</span>`;
}

// --- LOGS CRUD & RENDERING ---

function renderLogs() {
  const searchQuery = elements.logSearchInput.value.toLowerCase().trim();
  const tbody = elements.logsTableBody;
  tbody.innerHTML = '';
  
  const filtered = readingLogs.filter(log => {
    return log.title.toLowerCase().includes(searchQuery) || 
           log.author.toLowerCase().includes(searchQuery);
  });
  
  if (filtered.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" class="empty-state">
          ${searchQuery ? '검색 결과에 부합하는 도서 기록이 없습니다.' : '독서 기록이 아직 없습니다. 새로운 기록을 추가해보세요!'}
        </td>
      </tr>
    `;
    return;
  }
  
  filtered.forEach(log => {
    // Find index in original array
    const originalIndex = readingLogs.findIndex(item => 
      item.title === log.title && 
      item.author === log.author && 
      item.date === log.date && 
      item.pages === log.pages
    );
    
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="book-title-cell" style="font-weight: 500; color: var(--color-primary);"><strong>${escapeHtml(log.title)}</strong></td>
      <td>${escapeHtml(log.author)}</td>
      <td>${log.date}</td>
      <td>${log.pages}쪽</td>
      <td>
        <div class="action-buttons">
          <button class="action-btn edit" data-idx="${originalIndex}">수정</button>
          <button class="action-btn review" data-idx="${originalIndex}">감상문</button>
          <button class="action-btn delete" data-idx="${originalIndex}">삭제</button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });
  
  // Attach Action Button Handlers
  tbody.querySelectorAll('.edit').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const idx = e.target.dataset.idx;
      openModal(idx);
    });
  });
  
  tbody.querySelectorAll('.review').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const idx = parseInt(e.target.dataset.idx);
      switchTab('tab-report');
      elements.reportBookSelect.value = idx;
      triggerReportBookSelect(idx);
    });
  });
  
  tbody.querySelectorAll('.delete').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const idx = parseInt(e.target.dataset.idx);
      const log = readingLogs[idx];
      if (confirm(`'${log.title}' 기록을 정말 삭제하시겠습니까?`)) {
        readingLogs.splice(idx, 1);
        const saved = await saveData();
        if (saved) {
          refreshUI();
        }
      }
    });
  });
}

function openModal(index = -1) {
  elements.logModal.classList.add('open');
  if (index >= 0) {
    const log = readingLogs[index];
    elements.modalTitle.textContent = '독서 기록 수정';
    elements.editIndex.value = index;
    elements.inputTitle.value = log.title;
    elements.inputAuthor.value = log.author;
    elements.inputDate.value = log.date;
    elements.inputPages.value = log.pages;
  } else {
    elements.modalTitle.textContent = '새 독서 기록 추가';
    elements.editIndex.value = -1;
    elements.inputTitle.value = '';
    elements.inputAuthor.value = '';
    setDefaultDate();
    elements.inputPages.value = '';
  }
}

function closeModal() {
  elements.logModal.classList.remove('open');
}

// Helper to escape HTML tags
function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
}

// --- BOOK REPORT EDITOR LOGIC ---

function updateReportSelector() {
  const select = elements.reportBookSelect;
  const currentVal = select.value;
  select.innerHTML = '<option value="-1">-- 책을 선택해 주세요 --</option>';
  
  // Sort logs by date descending for select box
  readingLogs.forEach((log, index) => {
    const option = document.createElement('option');
    option.value = index;
    option.textContent = `${log.title} (${log.author})`;
    select.appendChild(option);
  });
  
  // Maintain selection if still valid
  if (currentVal >= 0 && currentVal < readingLogs.length) {
    select.value = currentVal;
  } else {
    // Hide editor card, show empty panel
    elements.reportEditorBox.classList.add('hidden');
    elements.reportEmptyBox.classList.remove('hidden');
  }
}

function triggerReportBookSelect(index) {
  if (index < 0 || index >= readingLogs.length) {
    elements.reportEditorBox.classList.add('hidden');
    elements.reportEmptyBox.classList.remove('hidden');
    return;
  }
  
  const log = readingLogs[index];
  
  // Show editor box
  elements.reportEmptyBox.classList.add('hidden');
  elements.reportEditorBox.classList.remove('hidden');
  
  // Fill details
  elements.reportBookTitle.textContent = log.title;
  elements.reportBookAuthor.textContent = log.author;
  elements.reportBookDate.textContent = log.date;
  elements.reportBookPages.textContent = log.pages;
  
  // Set text
  elements.reportTextarea.value = log.review || '';
  elements.saveStatus.textContent = '마지막 저장: 자동 저장 활성화됨';
}

// Auto-save logic (Debounce)
function handleReportInput() {
  elements.saveStatus.textContent = '작성 중...';
  
  if (autoSaveTimer) clearTimeout(autoSaveTimer);
  
  autoSaveTimer = setTimeout(async () => {
    const idx = parseInt(elements.reportBookSelect.value);
    if (idx >= 0 && idx < readingLogs.length) {
      readingLogs[idx].review = elements.reportTextarea.value;
      const saved = await saveData();
      if (saved) {
        const now = new Date();
        const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
        elements.saveStatus.textContent = `마지막 저장: ${timeStr} (자동 저장 완료)`;
      } else {
        elements.saveStatus.textContent = '저장 실패';
      }
    }
  }, 1000); // Wait 1 second after typing stops
}

// --- CUSTOM SVG LINE GRAPH RENDERER ---

function renderChart() {
  const svg = elements.statsChart;
  // Clear dynamic elements, keeping <defs>
  const defs = svg.querySelector('defs');
  svg.innerHTML = '';
  if (defs) svg.appendChild(defs);
  
  const width = 800;
  const height = 350;
  const paddingLeft = 60;
  const paddingRight = 40;
  const paddingTop = 40;
  const paddingBottom = 40;
  
  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;
  
  // Calculate labels and ranges
  let chartData = [];
  
  if (activeChartType === 'week') {
    chartData = getWeeklyData();
  } else {
    chartData = getMonthlyData();
  }
  
  if (chartData.length === 0) {
    // Render blank slate message
    const txt = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    txt.setAttribute('x', String(width / 2));
    txt.setAttribute('y', String(height / 2));
    txt.setAttribute('text-anchor', 'middle');
    txt.setAttribute('fill', 'var(--color-text-muted)');
    txt.setAttribute('font-family', 'var(--font-serif)');
    txt.setAttribute('font-size', '16px');
    txt.textContent = '통계를 그릴 독서 데이터가 부족합니다.';
    svg.appendChild(txt);
    return;
  }
  
  // Max Y value calculation
  const maxVal = Math.max(...chartData.map(d => d.value));
  const yAxisMax = Math.max(4, Math.ceil(maxVal * 1.25)); // Buffer space above max value, min scale of 4
  
  // Draw Grid Lines (Horizontal)
  const yTicks = 4;
  for (let i = 0; i <= yTicks; i++) {
    const yVal = (yAxisMax / yTicks) * i;
    const yPos = height - paddingBottom - (chartHeight * (yVal / yAxisMax));
    
    // Grid Line
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('x1', String(paddingLeft));
    line.setAttribute('y1', String(yPos));
    line.setAttribute('x2', String(width - paddingRight));
    line.setAttribute('y2', String(yPos));
    line.setAttribute('class', i === 0 ? 'chart-axis-line' : 'chart-grid-line');
    svg.appendChild(line);
    
    // Y Label
    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    text.setAttribute('x', String(paddingLeft - 12));
    text.setAttribute('y', String(yPos + 4));
    text.setAttribute('class', 'chart-y-label');
    text.textContent = `${Math.round(yVal)}권`;
    svg.appendChild(text);
  }
  
  // Calculate X Coordinates
  const xPoints = [];
  const spacing = chartWidth / (chartData.length - 1 || 1);
  
  chartData.forEach((data, index) => {
    const x = paddingLeft + spacing * index;
    const y = height - paddingBottom - (chartHeight * (data.value / yAxisMax));
    xPoints.push({ x, y, label: data.label, value: data.value, tooltipLabel: data.tooltipLabel });
  });
  
  // Draw Fill Area under the line (Gradient)
  if (xPoints.length > 1) {
    let areaPathStr = `M ${xPoints[0].x} ${height - paddingBottom}`;
    xPoints.forEach(pt => {
      areaPathStr += ` L ${pt.x} ${pt.y}`;
    });
    areaPathStr += ` L ${xPoints[xPoints.length - 1].x} ${height - paddingBottom} Z`;
    
    const areaPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    areaPath.setAttribute('d', areaPathStr);
    areaPath.setAttribute('fill', 'url(#chart-area-grad)');
    svg.appendChild(areaPath);
  }
  
  // Draw Line Path
  if (xPoints.length > 1) {
    let linePathStr = `M ${xPoints[0].x} ${xPoints[0].y}`;
    for (let i = 1; i < xPoints.length; i++) {
      linePathStr += ` L ${xPoints[i].x} ${xPoints[i].y}`;
    }
    
    const linePath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    linePath.setAttribute('d', linePathStr);
    linePath.setAttribute('class', 'chart-line');
    // Animate drawing path
    const pathLength = 1000;
    linePath.setAttribute('stroke-dasharray', String(pathLength));
    linePath.setAttribute('stroke-dashoffset', String(pathLength));
    
    const animate = document.createElementNS('http://www.w3.org/2000/svg', 'animate');
    animate.setAttribute('attributeName', 'stroke-dashoffset');
    animate.setAttribute('from', String(pathLength));
    animate.setAttribute('to', '0');
    animate.setAttribute('dur', '0.6s');
    animate.setAttribute('fill', 'freeze');
    animate.setAttribute('calcMode', 'ease-in-out');
    linePath.appendChild(animate);
    
    svg.appendChild(linePath);
  }
  
  // Draw X Labels & Vertical Reference Lines
  xPoints.forEach(pt => {
    // X Label
    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    text.setAttribute('x', String(pt.x));
    text.setAttribute('y', String(height - paddingBottom + 24));
    text.setAttribute('class', 'chart-label');
    text.textContent = pt.label;
    svg.appendChild(text);
  });
  
  // Draw Circle Dots & Interaction Handles
  xPoints.forEach((pt, index) => {
    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    circle.setAttribute('cx', String(pt.x));
    circle.setAttribute('cy', String(pt.y));
    circle.setAttribute('r', '5.5');
    circle.setAttribute('class', 'chart-point');
    
    // Add tooltip triggers
    circle.addEventListener('mouseenter', (e) => {
      circle.classList.add('chart-point-active');
      showTooltip(e, pt.tooltipLabel, pt.value);
    });
    
    circle.addEventListener('mousemove', (e) => {
      moveTooltip(e);
    });
    
    circle.addEventListener('mouseleave', () => {
      circle.classList.remove('chart-point-active');
      hideTooltip();
    });
    
    svg.appendChild(circle);
  });
}

// Tooltip helpers
function showTooltip(event, label, value) {
  const tooltip = elements.chartTooltip;
  tooltip.innerHTML = `<strong>${escapeHtml(label)}</strong><br>${value}권 완독`;
  tooltip.style.opacity = '1';
  moveTooltip(event);
}

function moveTooltip(event) {
  const tooltip = elements.chartTooltip;
  const rect = elements.statsChart.getBoundingClientRect();
  
  // Calculate relative mouse position within SVG container
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;
  
  tooltip.style.left = `${x}px`;
  tooltip.style.top = `${y - 12}px`;
}

function hideTooltip() {
  elements.chartTooltip.style.opacity = '0';
}

// Generate weekly stats (Last 8 calendar weeks)
function getWeeklyData() {
  const data = [];
  const now = new Date();
  
  // Get Monday of current week
  const day = now.getDay();
  const diffToMonday = now.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
  const currentMonday = new Date(now.setDate(diffToMonday));
  currentMonday.setHours(0,0,0,0);
  
  // Create 8 weeks backward
  for (let i = 7; i >= 0; i--) {
    const startOfWeek = new Date(currentMonday);
    startOfWeek.setDate(currentMonday.getDate() - i * 7);
    
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);
    
    // Count books
    let count = 0;
    readingLogs.forEach(log => {
      const [y, m, d] = log.date.split('-').map(Number);
      const logDate = new Date(y, m - 1, d);
      if (logDate >= startOfWeek && logDate <= endOfWeek) {
        count++;
      }
    });
    
    // Label e.g., "6/8주" (week starting June 8th)
    const weekStartMM = startOfWeek.getMonth() + 1;
    const weekStartDD = startOfWeek.getDate();
    const weekEndMM = endOfWeek.getMonth() + 1;
    const weekEndDD = endOfWeek.getDate();
    
    data.push({
      label: `${weekStartMM}/${weekStartDD}주`,
      tooltipLabel: `${weekStartMM}월 ${weekStartDD}일 ~ ${weekEndMM}월 ${weekEndDD}일`,
      value: count
    });
  }
  
  return data;
}

// Generate monthly stats (Last 6 calendar months)
function getMonthlyData() {
  const data = [];
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth(); // 0-11
  
  for (let i = 5; i >= 0; i--) {
    // Subtract months safely
    const targetDate = new Date(currentYear, currentMonth - i, 1);
    const y = targetDate.getFullYear();
    const m = targetDate.getMonth(); // 0-11
    
    const startOfMonth = new Date(y, m, 1);
    const endOfMonth = new Date(y, m + 1, 0, 23, 59, 59, 999);
    
    let count = 0;
    readingLogs.forEach(log => {
      const [ly, lm, ld] = log.date.split('-').map(Number);
      const logDate = new Date(ly, lm - 1, ld);
      if (logDate >= startOfMonth && logDate <= endOfMonth) {
        count++;
      }
    });
    
    data.push({
      label: `${m + 1}월`,
      tooltipLabel: `${y}년 ${m + 1}월`,
      value: count
    });
  }
  
  return data;
}

// --- EVENT LISTENERS ATTACHMENTS ---

function setupEventListeners() {
  // Navigation Tabs switching
  elements.tabBtns.dashboard.addEventListener('click', () => switchTab('tab-dashboard'));
  elements.tabBtns.logs.addEventListener('click', () => switchTab('tab-logs'));
  elements.tabBtns.report.addEventListener('click', () => switchTab('tab-report'));
  
  
  // Dashboard Chart Toggle Buttons
  elements.btnChartWeek.addEventListener('click', () => {
    elements.btnChartWeek.classList.add('active');
    elements.btnChartMonth.classList.remove('active');
    activeChartType = 'week';
    renderChart();
  });
  
  elements.btnChartMonth.addEventListener('click', () => {
    elements.btnChartMonth.classList.add('active');
    elements.btnChartWeek.classList.remove('active');
    activeChartType = 'month';
    renderChart();
  });
  
  // Logs search filter typing
  elements.logSearchInput.addEventListener('input', () => {
    renderLogs();
  });
  
  // Modal Open & Close triggers
  elements.btnOpenAddModal.addEventListener('click', () => openModal(-1));
  elements.btnCloseModal.addEventListener('click', closeModal);
  elements.btnCancelModal.addEventListener('click', closeModal);
  
  // Close modal when clicking outside content box
  window.addEventListener('click', (e) => {
    if (e.target === elements.logModal) {
      closeModal();
    }
  });
  
  // Form submission handler (Add/Edit)
  elements.logForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const index = parseInt(elements.editIndex.value);
    const newLog = {
      title: elements.inputTitle.value.trim(),
      author: elements.inputAuthor.value.trim(),
      date: elements.inputDate.value,
      pages: parseInt(elements.inputPages.value) || 0,
      review: index >= 0 ? readingLogs[index].review : '' // Preserve review on edit, blank on add
    };
    
    if (index >= 0) {
      // Update existing record
      readingLogs[index] = newLog;
    } else {
      // Add new record
      readingLogs.push(newLog);
    }
    
    const saved = await saveData();
    if (saved) {
      closeModal();
      refreshUI();
    }
  });
  
  // Report Editor Selector
  elements.reportBookSelect.addEventListener('change', (e) => {
    const idx = parseInt(e.target.value);
    triggerReportBookSelect(idx);
  });
  
  // Report Text Typing (Auto Save)
  elements.reportTextarea.addEventListener('input', handleReportInput);
  
  // Report Save Button (Manual Trigger force-save)
  elements.btnSaveReport.addEventListener('click', async () => {
    if (autoSaveTimer) clearTimeout(autoSaveTimer);
    
    const idx = parseInt(elements.reportBookSelect.value);
    if (idx >= 0 && idx < readingLogs.length) {
      readingLogs[idx].review = elements.reportTextarea.value;
      const saved = await saveData();
      if (saved) {
        const now = new Date();
        const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
        elements.saveStatus.textContent = `마지막 저장: ${timeStr} (수동 저장 완료)`;
        alert('감상문이 안전하게 저장되었습니다.');
      } else {
        alert('저장에 실패했습니다.');
      }
    }
  });
}
