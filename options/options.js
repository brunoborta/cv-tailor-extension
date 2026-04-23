import { DEFAULT_MODELS, API_KEY_HINTS } from '../lib/ai-client.js';
import { getProfile, setProfile, patchProfile, getAiConfig, setAiConfig } from '../lib/storage.js';

let languages = [];
let currentPdfBase64 = null;
let currentPdfFileName = null;

const SVG_EYE = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`;
const SVG_EYE_OFF = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`;

async function init() {
  setupTabs();
  setupPresets();
  setupLanguages();
  document.getElementById('saveBtn').addEventListener('click', save);
  setupCVUpload();
  document.getElementById('toggleApiKey').addEventListener('click', () => {
    const input = document.getElementById('apiKey');
    const btn = document.getElementById('toggleApiKey');
    const isHidden = input.type === 'password';
    input.type = isHidden ? 'text' : 'password';
    btn.innerHTML = isHidden ? SVG_EYE_OFF : SVG_EYE;
  });

  const [profile, aiConfig] = await Promise.all([getProfile(), getAiConfig()]);
  if (profile) loadProfile(profile);
  if (aiConfig) loadAIConfig(aiConfig);
}

function setupTabs() {
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById(`tab-${tab.dataset.tab}`).classList.add('active');
    });
  });
}

function setupPresets() {
  document.querySelectorAll('.preset-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const provider = btn.dataset.provider;
      document.getElementById('provider').value = provider;
      document.getElementById('providerLabel').textContent = btn.textContent.replace(/✓free/i, '').trim();
      onProviderChange();
      document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });
}

function setupCVUpload() {
  const fileInput = document.getElementById('cvFile');
  const dropZone = document.getElementById('uploadArea');
  const textarea = document.getElementById('cvText');

  dropZone.addEventListener('click', e => {
    if (e.target.id !== 'clearFileBtn' && !dropZone.classList.contains('has-file')) fileInput.click();
  });

  dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('dragover'); });
  dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
  dropZone.addEventListener('drop', e => {
    e.preventDefault();
    dropZone.classList.remove('dragover');
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  });

  fileInput.addEventListener('change', () => {
    if (fileInput.files[0]) handleFile(fileInput.files[0]);
  });

  document.getElementById('clearFileBtn').addEventListener('click', clearFile);

  async function handleFile(file) {
    if (!file.name.match(/\.(pdf|txt)$/i)) {
      document.getElementById('uploadHint').textContent = '✕ Only PDF or .txt files are supported.';
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      document.getElementById('uploadHint').textContent = '✕ File is too large. Max 5MB.';
      return;
    }

    setDropZoneState('loading', file.name);
    textarea.disabled = true;
    textarea.style.opacity = '0.4';

    try {
      const isPdf = file.name.toLowerCase().endsWith('.pdf');
      const text = isPdf ? await extractPDF(file) : await readText(file);
      textarea.value = text;
      if (isPdf) {
        currentPdfBase64 = await fileToBase64(file);
        currentPdfFileName = file.name;
      } else {
        currentPdfBase64 = null;
        currentPdfFileName = null;
      }
      setDropZoneState('done', file.name, text.length);
      await patchProfile({ cvText: text, cvFileName: currentPdfFileName, cvPdfBase64: currentPdfBase64 });
      document.getElementById('uploadHint').textContent = `${text.length} characters extracted — saved.`;
    } catch (err) {
      document.getElementById('uploadHint').textContent = '✕ ' + err.message;
      clearFile();
    }
  }

  function setDropZoneState(state, fileName, charCount) {
    const zone = document.getElementById('uploadArea');
    const icon = document.getElementById('dropZoneIcon');
    const text = document.getElementById('dropZoneText');
    const sub = document.getElementById('dropZoneSubtext');
    const clearBtn = document.getElementById('clearFileBtn');

    if (state === 'loading') {
      icon.textContent = '⏳';
      text.textContent = `Extracting ${fileName}…`;
      sub.style.display = 'none';
      clearBtn.style.display = 'none';
      zone.classList.remove('has-file');
    } else if (state === 'done') {
      zone.classList.add('has-file');
      icon.textContent = '✅';
      text.textContent = fileName;
      sub.style.display = 'none';
      clearBtn.style.display = 'inline-block';
      document.getElementById('uploadHint').textContent = `${charCount} characters extracted.`;
    }
  }

  function clearFile() {
    fileInput.value = '';
    currentPdfBase64 = null;
    currentPdfFileName = null;
    const zone = document.getElementById('uploadArea');
    zone.classList.remove('has-file');
    document.getElementById('dropZoneIcon').textContent = '📄';
    document.getElementById('dropZoneText').textContent = 'Drop your PDF or .txt here';
    document.getElementById('dropZoneSubtext').textContent = 'or click to browse';
    document.getElementById('dropZoneSubtext').style.display = 'block';
    document.getElementById('clearFileBtn').style.display = 'none';
    document.getElementById('uploadHint').textContent = 'Text will be extracted automatically. Max file size: 5MB.';
    textarea.disabled = false;
    textarea.style.opacity = '1';
  }
}

async function extractPDF(file) {
  const pdfUrl = chrome.runtime.getURL('lib/build/pdf.mjs');
  const workerUrl = chrome.runtime.getURL('lib/build/pdf.worker.mjs');
  const pdfjsLib = await import(pdfUrl);
  pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

  const buffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
  const pages = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    pages.push(content.items.map(item => item.str).join(' '));
  }
  return pages.join('\n');
}

function readText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => resolve(e.target.result);
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsText(file);
  });
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => resolve(e.target.result.split(',')[1]);
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

function setupLanguages() {
  document.getElementById('addLangBtn').addEventListener('click', addLanguage);
  document.getElementById('langInput').addEventListener('keydown', e => {
    if (e.key === 'Enter') addLanguage();
  });
}

function addLanguage() {
  const input = document.getElementById('langInput');
  const val = input.value.trim();
  if (!val || languages.includes(val)) return;
  languages.push(val);
  input.value = '';
  renderLanguages();
}

function removeLanguage(lang) {
  languages = languages.filter(l => l !== lang);
  renderLanguages();
}

function renderLanguages() {
  const list = document.getElementById('languagesList');
  list.innerHTML = '';
  languages.forEach(lang => {
    const chip = document.createElement('div');
    chip.className = 'lang-chip';
    chip.innerHTML = `${lang}<button title="Remove">×</button>`;
    chip.querySelector('button').addEventListener('click', () => removeLanguage(lang));
    list.appendChild(chip);
  });
}

function onProviderChange() {
  const provider = document.getElementById('provider').value;
  const modelInput = document.getElementById('model');
  const hintEl = document.getElementById('apiKeyHint');
  const baseUrlGroup = document.getElementById('baseUrlGroup');

  if (DEFAULT_MODELS[provider] && !modelInput.value) {
    modelInput.value = DEFAULT_MODELS[provider];
  }
  hintEl.textContent = API_KEY_HINTS[provider] || '';
  baseUrlGroup.style.display = provider === 'custom' ? 'block' : 'none';

  document.querySelectorAll('.preset-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.provider === provider);
  });
}

function loadProfile(profile) {
  document.getElementById('firstName').value = profile.personal?.firstName || '';
  document.getElementById('lastName').value = profile.personal?.lastName || '';
  document.getElementById('email').value = profile.personal?.email || '';
  document.getElementById('phone').value = profile.personal?.phone || '';
  document.getElementById('location').value = profile.personal?.location || '';
  document.getElementById('linkedin').value = profile.personal?.linkedin || '';
  document.getElementById('hearAboutUs').value = profile.personal?.hearAboutUs || '';
  document.getElementById('cvText').value = profile.cvText || '';
  if (profile.cvFileName) {
    currentPdfFileName = profile.cvFileName;
    currentPdfBase64 = profile.cvPdfBase64 || null;
    document.getElementById('uploadArea').classList.add('has-file');
    document.getElementById('dropZoneIcon').textContent = '✅';
    document.getElementById('dropZoneText').textContent = profile.cvFileName;
    document.getElementById('dropZoneSubtext').style.display = 'none';
    document.getElementById('clearFileBtn').style.display = 'inline-block';
    document.getElementById('cvText').disabled = true;
    document.getElementById('cvText').style.opacity = '0.4';
    document.getElementById('uploadHint').textContent = `${(profile.cvText || '').length} characters extracted.`;
  }
  languages = profile.languages || [];
  renderLanguages();
}

function loadAIConfig(config) {
  const provider = config.provider || 'deepseek';
  document.getElementById('provider').value = provider;
  document.getElementById('apiKey').value = config.apiKey || '';
  document.getElementById('model').value = config.model || '';
  document.getElementById('baseUrl').value = config.baseUrl || '';
  document.getElementById('outputLanguage').value = config.outputLanguage || 'auto';
  document.getElementById('autofill').checked = config.autofill || false;

  const activeBtn = document.querySelector(`.preset-btn[data-provider="${provider}"]`);
  if (activeBtn) {
    document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active'));
    activeBtn.classList.add('active');
    document.getElementById('providerLabel').textContent = activeBtn.textContent.replace(/✓free/i, '').trim();
  }

  onProviderChange();
}

async function save() {
  const profile = {
    personal: buildPersonal(),
    languages,
    cvText: document.getElementById('cvText').value.trim(),
    cvFileName: currentPdfFileName,
    cvPdfBase64: currentPdfBase64,
  };

  const provider = document.getElementById('provider').value;
  const aiConfig = {
    provider,
    apiKey: document.getElementById('apiKey').value.trim(),
    model: document.getElementById('model').value.trim() || DEFAULT_MODELS[provider],
    baseUrl: document.getElementById('baseUrl').value.trim() || undefined,
    outputLanguage: document.getElementById('outputLanguage').value,
    autofill: document.getElementById('autofill').checked,
  };

  await Promise.all([setProfile(profile), setAiConfig(aiConfig)]);

  const overlay = document.getElementById('saveOverlay');
  overlay.classList.add('visible');
  setTimeout(() => overlay.classList.remove('visible'), 1500);
}

function buildPersonal() {
  const firstName = document.getElementById('firstName').value.trim();
  const lastName = document.getElementById('lastName').value.trim();
  const fullName = [firstName, lastName].filter(Boolean).join(' ');

  const rawPhone = document.getElementById('phone').value.trim();
  const phoneMatch = rawPhone.match(/^(\+\d{1,3})\s*(.*)$/);
  const phoneCountryCode = phoneMatch ? phoneMatch[1] : '';
  const phoneLocal = phoneMatch ? phoneMatch[2].trim() : rawPhone;

  return {
    name: fullName,
    firstName,
    lastName,
    email: document.getElementById('email').value.trim(),
    phone: rawPhone,
    phoneCountryCode,
    phoneLocal,
    location: document.getElementById('location').value.trim(),
    linkedin: document.getElementById('linkedin').value.trim(),
    hearAboutUs: document.getElementById('hearAboutUs').value.trim() || 'LinkedIn',
  };
}

document.addEventListener('DOMContentLoaded', init);
