import { setPrintHtml } from './storage.js';

export function setupPreviewPage({ title, printBtnLabel, contentId, editSelector, storageKind, htmlPath }) {
  const isPrint = new URLSearchParams(location.search).has('print');
  if (!isPrint) {
    buildToolbar(title, printBtnLabel, contentId, editSelector, storageKind, htmlPath);
  }
  return isPrint;
}

export function triggerPrint() {
  window.addEventListener('afterprint', () => window.close());
  window.print();
}

function buildToolbar(title, printBtnLabel, contentId, editSelector, storageKind, htmlPath) {
  const toolbar = document.createElement('div');
  toolbar.className = 'toolbar';
  toolbar.innerHTML = `
    <span id="toolbarTitle">${esc(title)}</span>
    <div class="toolbar-actions">
      <span class="toolbar-hint">In the print dialog, set Destination to <strong>Save as PDF</strong></span>
      <button id="editBtn">Edit</button>
      <button id="printBtn">${esc(printBtnLabel)}</button>
    </div>
  `;
  document.body.prepend(toolbar);

  let isEditing = false;
  document.getElementById('editBtn').addEventListener('click', () => {
    isEditing = !isEditing;
    const editTarget = editSelector ? document.querySelector(editSelector) : document.getElementById(contentId);
    if (editTarget) editTarget.contentEditable = isEditing ? 'true' : 'false';
    document.getElementById(contentId).classList.toggle('editing', isEditing);
    const btn = document.getElementById('editBtn');
    btn.textContent = isEditing ? 'Done' : 'Edit';
    btn.classList.toggle('active', isEditing);
  });

  document.getElementById('printBtn').addEventListener('click', async () => {
    const editedHtml = document.getElementById(contentId).innerHTML;
    await setPrintHtml(storageKind, editedHtml);
    chrome.tabs.create({ url: chrome.runtime.getURL(htmlPath) + '?print=1' });
  });
}

function esc(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
