// Photobook for macOS: a small Electron shell around the web app.
//
// The app files are served from inside the bundle on a private app://
// scheme, so the browser storage (books, photos, templates) lives in
// ~/Library/Application Support/Photobook and survives updates of the app.

const { app, BrowserWindow, Menu, protocol, net, shell, dialog } = require('electron');
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

app.setName('Photobook');
const ROOT = path.join(__dirname, 'web');

protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true, corsEnabled: true } },
]);

function createWindow() {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 960,
    minHeight: 640,
    backgroundColor: '#141414',
    title: 'Photobook',
    titleBarStyle: 'default',
    webPreferences: { contextIsolation: true, sandbox: true, spellcheck: true },
  });
  win.loadURL('app://photobook/index.html');
  // Links to other sites open in the default browser.
  win.webContents.setWindowOpenHandler(({ url }) => { shell.openExternal(url); return { action: 'deny' }; });
  win.webContents.on('will-navigate', (e, url) => { if (!url.startsWith('app://')) { e.preventDefault(); shell.openExternal(url); } });
  // Exports ask where to save, like a desktop app.
  win.webContents.session.on('will-download', (e, item) => {
    const target = dialog.showSaveDialogSync(win, { defaultPath: path.join(app.getPath('downloads'), item.getFilename()) });
    if (target) item.setSavePath(target); else item.cancel();
  });
  return win;
}

// Undo/redo go to the book unless a text field has focus.
const send = (cmd) => (_, win) => win && win.webContents.executeJavaScript(
  `(document.activeElement && document.activeElement.matches('input, textarea, [contenteditable]')) ? document.execCommand('${cmd}') : window.photobook && window.photobook.${cmd}()`,
);

function buildMenu() {
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    { role: 'appMenu' },
    { role: 'fileMenu' },
    {
      label: 'Edit',
      submenu: [
        { label: 'Undo', accelerator: 'CmdOrCtrl+Z', click: send('undo') },
        { label: 'Redo', accelerator: 'Shift+CmdOrCtrl+Z', click: send('redo') },
        { type: 'separator' },
        { role: 'cut' }, { role: 'copy' }, { role: 'paste' }, { role: 'selectAll' },
      ],
    },
    {
      label: 'View',
      submenu: [{ role: 'reload' }, { role: 'toggleDevTools' }, { type: 'separator' }, { role: 'togglefullscreen' }],
    },
    { role: 'windowMenu' },
  ]));
}

app.whenReady().then(() => {
  protocol.handle('app', (req) => {
    const rel = decodeURIComponent(new URL(req.url).pathname);
    const file = path.normalize(path.join(ROOT, rel));
    if (!file.startsWith(ROOT) || !fs.existsSync(file)) return new Response('Not found', { status: 404 });
    return net.fetch(pathToFileURL(file).toString());
  });
  buildMenu();
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on('window-all-closed', () => app.quit());
