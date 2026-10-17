// The books menu: switch books, start new ones, back up and restore.

import { app, createBook, openBook, listBooks, deleteBook, duplicateBook } from './state.js';
import { backupBlob, backupName, restoreBackup, folder, folderBackupSupported, chooseFolder, reconnectFolder, stopFolder, syncFolder, restoreFromFolder } from './backup.js';
import { storageEstimate, requestPersistence } from './db.js';
import { h, download, pickFiles, fmtBytes } from './util.js';
import { popover, closePopover, modal, toast, confirmDialog } from './dialogs.js';
import { icon } from './icons.js';

export function openBooksMenu(anchor, { loadDemo, openDesign }) {
  const item = (label, fn, extra) => h('button.menu-item', { on: { click: () => { closePopover(); fn(); } } }, label, extra ? h('small', extra) : null);
  const folderLabel = {
    off: 'Back up to a folder…',
    ready: 'Backup folder: on',
    writing: 'Backup folder: saving…',
    'needs-permission': 'Reconnect backup folder',
    error: 'Backup folder: error',
  }[folder.state];
  popover(anchor, h('div', { style: { minWidth: '270px' } },
    h('div.menu-head', 'Books'),
    item('Open another book…', () => openBookList(loadDemo)),
    item('New empty book', async () => { await openBook(await createBook()); toast('New book — drop photos to fill it'); }),
    item('New book from demo photos', loadDemo),
    item('Duplicate this book', async () => { await openBook(await duplicateBook(app.book)); toast('Duplicated'); }),
    item('Book & theme settings', () => openDesign()),
    h('div.menu-sep'),
    h('div.menu-head', 'Backup'),
    item('Download backup', downloadBackup, '.photobook'),
    item('Restore from backup…', restoreFile),
    folderBackupSupported() ? item(folderLabel, folderAction, folder.last ? new Date(folder.last).toLocaleTimeString() : '') : null,
    folderBackupSupported() && folder.state !== 'off' ? item('Stop folder backup', stopFolder) : null,
    folderBackupSupported() ? item('Restore from a backup folder…', async () => { try { await openBook(await restoreFromFolder()); toast('Restored'); } catch (e) { if (e.name !== 'AbortError') toast(e.message, { error: true }); } }) : null,
    item('Storage on this device', showStorage)));
}

async function folderAction() {
  try {
    if (folder.state === 'needs-permission') await reconnectFolder();
    else if (folder.state === 'off' || folder.state === 'error') await chooseFolder();
    else await syncFolder(app.book);
    toast('Backing up to the folder after every change');
  } catch (e) { if (e.name !== 'AbortError') toast(e.message, { error: true }); }
}

export async function downloadBackup() {
  const t = toast('Preparing backup…', { timeout: 60000 });
  try {
    const blob = await backupBlob(app.book);
    download(blob, backupName(app.book));
    t.remove();
    toast(`Backup saved (${fmtBytes(blob.size)})`);
  } catch (e) { t.remove(); toast('Backup failed: ' + e.message, { error: true }); }
}

async function restoreFile() {
  const [f] = await pickFiles({ accept: '.photobook,.zip', multiple: false });
  if (!f) return;
  const t = toast('Restoring…', { timeout: 120000 });
  try {
    const book = await restoreBackup(f);
    await openBook(book);
    t.remove();
    toast(`Restored “${book.meta.title}”`);
  } catch (e) { t.remove(); toast(e.message, { error: true }); }
}

async function openBookList(loadDemo) {
  const books = await listBooks();
  const list = h('div.list');
  const m = modal('Your books', h('div.body', list), { footer: [h('button.txt-btn', { on: { click: () => { m.close(); loadDemo(); } } }, 'New from demo photos')] });
  const draw = (bs) => list.replaceChildren(...bs.map((b) => h('div.list-row',
    icon('book'),
    h('div.grow', h('div', b.meta.title || 'Untitled'), h('div.sub', `${b.photos.length} photos · ${b.items.filter((i) => i.kind === 'spread').length} spreads · edited ${new Date(b.updatedAt).toLocaleString()}`)),
    b.id === app.book.id ? h('span.sub', 'Open') : h('button.txt-btn.small', { on: { click: async () => { m.close(); await openBook(b); } } }, 'Open'),
    b.id === app.book.id ? null : h('button.icon-btn', { title: 'Delete book', on: { click: async () => {
      if (!(await confirmDialog('Delete book', `Delete “${b.meta.title}”? Its photos stay in the browser until no book uses them.`, 'Delete', { danger: true }))) return;
      await deleteBook(b.id);
      draw(await listBooks());
    } } }, icon('trash')))));
  draw(books);
}

async function showStorage() {
  const est = await storageEstimate();
  const persisted = await requestPersistence();
  modal('Storage', h('div.body',
    h('p', `Photos and books are kept in this browser's storage on this device. Nothing is uploaded.`),
    est ? h('p', `Using ${fmtBytes(est.usage || 0)} of about ${fmtBytes(est.quota || 0)} available.`) : null,
    h('p', persisted ? 'Storage is marked persistent, so the browser will not clear it to save space.' : 'The browser has not granted persistent storage, so it may clear data under storage pressure — keep a backup.'),
    h('p.hint', 'Clearing site data for this page deletes everything. Use Download backup or folder backup to keep a copy.')));
}
