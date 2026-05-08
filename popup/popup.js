import { getProfile, getAiConfig, getPreview, setPreview, clearPreview } from '../lib/storage.js';

let currentTab = null;
let jobInfo = null;
let cvResult = null;
let userProfile = null;
let generationMode = 'optimize';

const modeHints = {
  optimize: 'Keeps your real experience — rewrites keywords to pass ATS filters.',
  scratch: 'Builds a CV from zero — bridges your skills creatively to the job.',
};

async function init() {
  document.getElementById('openOptions').addEventListener('click', openOptions);
  document.getElementById('openOptionsFromEmpty')?.addEventListener('click', openOptions);
  document.getElementById('generateBtn').addEventListener('click', generateCV);
  document.getElementById('resetBtn').addEventListener('click', resetCV);
  document.getElementById('refreshJobBtn').addEventListener('click', refreshJob);

  document.querySelectorAll('.mode-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      generationMode = btn.dataset.mode;
      document.getElementById('modeHint').textContent = modeHints[generationMode];
    });
  });
  document.getElementById('previewBtn').addEventListener('click', previewPDF);
  document.getElementById('coverLetterBtn').addEventListener('click', () => {
    chrome.tabs.create({ url: chrome.runtime.getURL('cv-preview/cover-letter.html') });
  });

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  currentTab = tab;

  const [profile, aiConfig, cv_tailor_preview] = await Promise.all([getProfile(), getAiConfig(), getPreview()]);
  userProfile = profile;

  if (!aiConfig?.apiKey) {
    document.getElementById('noProfile').style.display = 'block';
    document.getElementById('mainContent').style.display = 'none';
    return;
  }

  if (!profile?.cvText) {
    const optimizeBtn = document.querySelector('[data-mode="optimize"]');
    optimizeBtn.disabled = true;
    optimizeBtn.title = 'Upload your CV in Settings to use ATS Optimize';
    generationMode = 'scratch';
    document.querySelectorAll('.mode-btn').forEach(b => b.classList.toggle('active', b.dataset.mode === 'scratch'));
    document.getElementById('modeHint').textContent = modeHints.scratch;
  }

  if (cv_tailor_preview?.result) {
    cvResult = cv_tailor_preview.result;
    generationMode = cv_tailor_preview.mode || 'optimize';
    document.querySelectorAll('.mode-btn').forEach(b => b.classList.toggle('active', b.dataset.mode === generationMode));
    document.getElementById('modeHint').textContent = modeHints[generationMode];
    document.getElementById('generateSection').style.display = 'none';
    renderResults(cvResult);
    const ago = formatAgo(cv_tailor_preview.generatedAt);
    document.getElementById('savedLabel').textContent = `Saved · ${ago}`;
    const { jobTitle, jobCompany } = cv_tailor_preview;
    document.getElementById('jobTitle').textContent =
      [jobCompany, jobTitle].filter(Boolean).join(' • ') || 'Job info unavailable';
    document.getElementById('jobMeta').textContent = '';
    jobInfo = { title: jobTitle, company: jobCompany };
  } else {
    getJobInfo();
  }
}

function formatAgo(isoDate) {
  const diff = Math.round((Date.now() - new Date(isoDate)) / 60000);
  if (diff < 60) return `${diff}m ago`;
  if (diff < 1440) return `${Math.round(diff / 60)}h ago`;
  return `${Math.round(diff / 1440)}d ago`;
}

async function resetCV() {
  await clearPreview();
  cvResult = null;
  jobInfo = null;
  document.getElementById('results').classList.remove('visible');
  document.getElementById('savedLabel').textContent = '';
  document.getElementById('generateSection').style.display = 'block';
  getJobInfo();
}

async function refreshJob() {
  await clearPreview();
  cvResult = null;
  jobInfo = null;
  document.getElementById('results').classList.remove('visible');
  document.getElementById('savedLabel').textContent = '';
  document.getElementById('generateSection').style.display = 'block';
  getJobInfo({ forceRefresh: true });
}

function syncRefreshBtnVisibility() {
  const resultsVisible = document.getElementById('results').classList.contains('visible');
  document.getElementById('refreshJobBtn').style.display = resultsVisible ? 'none' : '';
}

async function getJobInfo({ forceRefresh = false } = {}) {
  document.getElementById('refreshJobBtn').style.display = 'none';
  document.getElementById('jobTitle').textContent = 'Detecting job…';
  document.getElementById('jobMeta').textContent = 'Reading page';
  setStatus('<span class="spinner"></span>Reading page…', false);
  try {
    const frames = await chrome.webNavigation.getAllFrames({ tabId: currentTab.id });
    const results = await Promise.all(
      frames.map(f =>
        chrome.tabs.sendMessage(currentTab.id, { type: 'GET_JOB_INFO' }, { frameId: f.frameId })
          .catch(() => null)
      )
    );
    const seen = [];
    for (const r of results) {
      const t = r?.pageText?.trim();
      if (!t) continue;
      if (seen.some(s => s.includes(t) || t.includes(s))) continue;
      seen.push(t);
    }
    const pageText = seen.join('\n\n---\n\n').slice(0, 12000);

    if (!pageText) {
      document.getElementById('jobTitle').textContent = 'Could not read page';
      document.getElementById('jobMeta').textContent = 'Try refreshing the tab';
      clearStatus();
      return;
    }

    setStatus('<span class="spinner"></span>Detecting job…', false);
    const aiConfig = await getAiConfig();

    if (!aiConfig?.apiKey) {
      document.getElementById('jobTitle').textContent = 'No API key — open Settings';
      document.getElementById('jobMeta').textContent = '';
      clearStatus();
      return;
    }

    const res = await chrome.runtime.sendMessage({
      type: 'PARSE_JOB_PAGE',
      payload: { pageText, aiConfig, forceRefresh },
    });

    if (res.error) {
      document.getElementById('jobTitle').textContent = 'Parse error';
      document.getElementById('jobMeta').textContent = res.error;
      clearStatus();
      return;
    }

    jobInfo = res;

    document.getElementById('jobTitle').textContent =
      [jobInfo.company, jobInfo.title].filter(Boolean).join(' • ') || 'No job detected';
    document.getElementById('jobMeta').textContent =
      jobInfo.requirements?.length
        ? `${jobInfo.requirements.length} requirements detected`
        : jobInfo.description ? 'Description found' : 'No description found';
    clearStatus();
  } catch (err) {
    document.getElementById('jobTitle').textContent = 'Could not read page';
    document.getElementById('jobMeta').textContent = 'Try refreshing the tab';
    clearStatus();
  } finally {
    syncRefreshBtnVisibility();
  }
}

async function generateCV() {
  const btn = document.getElementById('generateBtn');
  btn.disabled = true;
  setStatus('<span class="spinner"></span>Generating…', false);
  document.getElementById('results').classList.remove('visible');
  document.getElementById('refreshJobBtn').style.display = 'none';

  try {
    const [profile, aiConfig] = await Promise.all([getProfile(), getAiConfig()]);

    if (!aiConfig?.apiKey) {
      setStatus('No API key configured. Open Settings.', true);
      return;
    }

    if (!jobInfo?.title) {
      setStatus('No job detected. Open a job posting page first.', true);
      return;
    }

    const res = await chrome.runtime.sendMessage({
      type: 'GENERATE_CV',
      payload: {
        userProfile: profile,
        jobInfo,
        aiConfig,
        mode: generationMode,
      },
    });

    if (res.error) {
      setStatus(res.error, true);
      return;
    }

    cvResult = res;
    renderResults(cvResult);
    document.getElementById('generateSection').style.display = 'none';
    clearStatus();

    const generatedAt = new Date().toISOString();
    await setPreview({
      result: cvResult,
      profile,
      jobTitle: jobInfo?.title,
      jobCompany: jobInfo?.company,
      mode: generationMode,
      generatedAt,
    });
    document.getElementById('savedLabel').textContent = `Saved · ${formatAgo(generatedAt)}`;
  } catch (err) {
    setStatus(err.message, true);
  } finally {
    btn.disabled = false;
    syncRefreshBtnVisibility();
  }
}

function renderResults(data) {
  // Summary — array (optimize) or string (scratch)
  const summaryEl = document.getElementById('resSummary');
  if (Array.isArray(data.summary)) {
    summaryEl.textContent = data.summary[0] || '';
  } else {
    summaryEl.textContent = data.summary || '';
  }

  // Skills — object (optimize) or array (scratch)
  const skillsEl = document.getElementById('resSkills');
  skillsEl.innerHTML = '';
  const skillList = data.technicalSkills
    ? Object.values(data.technicalSkills).flat().slice(0, 8)
    : (data.skills || []);
  skillList.forEach(skill => {
    const chip = document.createElement('span');
    chip.className = 'skill-chip';
    chip.textContent = skill;
    skillsEl.appendChild(chip);
  });

  // Experience preview
  const expEl = document.getElementById('resExperience');
  expEl.innerHTML = '';
  if (data.experience?.length) {
    const first = data.experience[0];
    const preview = typeof first === 'string'
      ? [first]
      : (first.bullets || [first.description]).slice(0, 2);
    preview.forEach(text => {
      const li = document.createElement('li');
      li.textContent = text;
      expEl.appendChild(li);
    });
    if (data.experience.length > 1) {
      const more = document.createElement('li');
      more.style.color = '#999';
      more.style.fontStyle = 'italic';
      more.textContent = `+ ${data.experience.length - 1} more positions — see full CV preview`;
      expEl.appendChild(more);
    }
  }

  const cl = data.coverLetter;
  document.getElementById('resCover').textContent = Array.isArray(cl) ? cl[0] : (cl || '');
  document.getElementById('results').classList.add('visible');
  syncRefreshBtnVisibility();
}

function previewPDF() {
  const url = chrome.runtime.getURL('cv-preview/index.html');
  chrome.tabs.create({ url });
}

function openOptions() {
  chrome.runtime.openOptionsPage();
}

function setStatus(html, isError = false) {
  const el = document.getElementById('status');
  el.innerHTML = html;
  el.className = 'status visible' + (isError ? ' error' : '');
}

function clearStatus() {
  const el = document.getElementById('status');
  el.className = 'status';
}

document.addEventListener('DOMContentLoaded', init);
