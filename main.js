const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    },
    // Classic style frame
    title: '독서 기록 관리 프로그램',
    icon: path.join(__dirname, 'icon.png') // In case we add icon later
  });

  // Remove default menu for a clean look
  mainWindow.setMenuBarVisibility(false);

  // Open Developer Tools for debugging
  mainWindow.webContents.openDevTools();

  mainWindow.loadFile('index.html');
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// IPC Handler to get the CSV file path
function getCsvPath() {
  const docPath = app.getPath('documents');
  return path.join(docPath, '독서기록.csv');
}

ipcMain.on('log-error', (event, error) => {
  console.error('RENDERER_CONSOLE_ERROR:', error);
});

// Ensure CSV file exists
function ensureCsvFile() {
  const csvPath = getCsvPath();
  if (!fs.existsSync(csvPath)) {
    // UTF-8 BOM helps Excel open Korean CSV files correctly
    const header = '\uFEFF제목,저자,읽은날짜,읽은쪽수,감상문\n';
    fs.writeFileSync(csvPath, header, 'utf8');
  }
}

// IPC Handlers
ipcMain.handle('get-csv-path', () => {
  const p = getCsvPath();
  console.log('IPC: get-csv-path called ->', p);
  return p;
});

ipcMain.handle('read-csv', async () => {
  try {
    console.log('IPC: read-csv called');
    ensureCsvFile();
    const csvPath = getCsvPath();
    const data = fs.readFileSync(csvPath, 'utf8');
    console.log('IPC: read-csv success, bytes read:', data.length);
    return { success: true, data };
  } catch (error) {
    console.error('IPC: Failed to read CSV:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('write-csv', async (event, csvContent) => {
  try {
    console.log('IPC: write-csv called, bytes to write:', csvContent.length);
    const csvPath = getCsvPath();
    // Prepend UTF-8 BOM if it doesn't already have one
    let content = csvContent;
    if (!content.startsWith('\uFEFF')) {
      content = '\uFEFF' + content;
    }
    fs.writeFileSync(csvPath, content, 'utf8');
    console.log('IPC: write-csv success');
    return { success: true };
  } catch (error) {
    console.error('IPC: Failed to write CSV:', error);
    return { success: false, error: error.message };
  }
});
