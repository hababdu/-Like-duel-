// Like-Duel desktop: yig'ilgan web ilovani lokal serverda ochadi (http://localhost:38123).
// Origin barqaror bo'lishi kerak: Google kirish va backend CORS shu manzilga tayanadi.
const { app, BrowserWindow, shell } = require('electron');
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 38123;
const WEB_DIR = path.join(__dirname, 'web');
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'application/javascript', '.css': 'text/css',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon',
  '.woff2': 'font/woff2', '.map': 'application/json', '.txt': 'text/plain'
};

function startServer() {
  const server = http.createServer((req, res) => {
    let rel = decodeURIComponent((req.url || '/').split('?')[0]);
    if (rel === '/') rel = '/index.html';
    const file = path.normalize(path.join(WEB_DIR, rel));
    if (!file.startsWith(WEB_DIR)) { res.writeHead(403); return res.end(); }
    fs.readFile(file, (err, data) => {
      if (err) { // SPA uchun index.html
        return fs.readFile(path.join(WEB_DIR, 'index.html'), (e2, idx) => {
          if (e2) { res.writeHead(404); return res.end(); }
          res.writeHead(200, { 'Content-Type': TYPES['.html'] }); res.end(idx);
        });
      }
      res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
      res.end(data);
    });
  });
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(PORT, '127.0.0.1', () => resolve(server));
  });
}

async function createWindow() {
  await startServer();
  const win = new BrowserWindow({
    width: 480, height: 860, minWidth: 380, minHeight: 600,
    backgroundColor: '#0c0c0e', title: 'Like-Duel',
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true }
  });
  // Google "embedded browser" cheklovini kamaytirish uchun oddiy Chrome UA
  win.webContents.setUserAgent(win.webContents.getUserAgent().replace(/\sElectron\/\S+/, '').replace(/\sLike-Duel\/\S+/, ''));

  win.webContents.setWindowOpenHandler(({ url }) => {
    let host = '';
    try { host = new URL(url).hostname; } catch {}
    // Google kirish oynasi ilova ichida ochiladi, qolgan havolalar (to'lov va h.k.) brauzerda
    if (/(^|\.)google\.com$/.test(host)) return { action: 'allow' };
    shell.openExternal(url);
    return { action: 'deny' };
  });
  win.loadURL(`http://localhost:${PORT}/`);
}

app.whenReady().then(createWindow).catch((e) => { console.error(e); app.quit(); });
app.on('window-all-closed', () => app.quit());
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
