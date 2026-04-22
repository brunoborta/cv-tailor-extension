let currentTab = null;
let jobInfo = null;
let cvResult = null;
let userProfile = null;
let generationMode = 'optimize';
// let cachedFields = null;    // FORM FILLING — halted
// let cachedAiAnswers = null; // FORM FILLING — halted

const modeHints = {
  optimize: 'Keeps your real experience — rewrites keywords to pass ATS filters.',
  scratch: 'Builds a CV from zero — bridges your skills creatively to the job.',
};

async function init() {
  document.getElementById('openOptions').addEventListener('click', openOptions);
  document.getElementById('openOptionsFromEmpty')?.addEventListener('click', openOptions);
  document.getElementById('generateBtn').addEventListener('click', generateCV);
  document.getElementById('resetBtn').addEventListener('click', resetCV);

  document.querySelectorAll('.mode-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      generationMode = btn.dataset.mode;
      document.getElementById('modeHint').textContent = modeHints[generationMode];
      // FORM FILLING — halted
      // document.getElementById('atsDisclaimer').classList.toggle('visible', generationMode === 'optimize');
    });
  });
  // FORM FILLING — halted
  // document.getElementById('fillFormBtn').addEventListener('click', fillForm);
  document.getElementById('previewBtn').addEventListener('click', previewPDF);
  document.getElementById('coverLetterBtn').addEventListener('click', () => {
    chrome.tabs.create({ url: chrome.runtime.getURL('cv-preview/cover-letter.html') });
  });

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  currentTab = tab;

  const { profile, aiConfig, cv_tailor_preview } = await chrome.storage.local.get(['profile', 'aiConfig', 'cv_tailor_preview']);
  userProfile = profile;

  // FORM FILLING — halted
  // const autofill = aiConfig?.autofill || false;
  // document.getElementById('fillFormBtn').style.display = autofill ? 'none' : '';
  // document.getElementById('autofillHint').style.display = autofill ? 'block' : 'none';

  if (!profile?.cvText || !aiConfig?.apiKey) {
    document.getElementById('noProfile').style.display = 'block';
    document.getElementById('mainContent').style.display = 'none';
    return;
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
  }

  getJobInfo();
}

function formatAgo(isoDate) {
  const diff = Math.round((Date.now() - new Date(isoDate)) / 60000);
  if (diff < 60) return `${diff}m ago`;
  if (diff < 1440) return `${Math.round(diff / 60)}h ago`;
  return `${Math.round(diff / 1440)}d ago`;
}

async function resetCV() {
  await chrome.storage.local.remove('cv_tailor_preview');
  cvResult = null;
  document.getElementById('results').classList.remove('visible');
  document.getElementById('savedLabel').textContent = '';
  document.getElementById('generateSection').style.display = 'block';
}

async function getJobInfo() {
  setStatus('<span class="spinner"></span>Reading page…', false);
  try {
    const frames = await chrome.webNavigation.getAllFrames({ tabId: currentTab.id });
    const results = await Promise.all(
      frames.map(f =>
        chrome.tabs.sendMessage(currentTab.id, { type: 'GET_JOB_INFO' }, { frameId: f.frameId })
          .catch(() => null)
      )
    );
    const pageText = results
      .filter(r => r?.pageText)
      .map(r => r.pageText)
      .join('\n\n---\n\n');

    console.log('[CV Tailor] total frames:', frames.length);
    console.log('[CV Tailor] combined pageText length:', pageText.length);

    if (!pageText) {
      document.getElementById('jobTitle').textContent = 'Could not read page';
      document.getElementById('jobMeta').textContent = 'Try refreshing the tab';
      clearStatus();
      return;
    }

    setStatus('<span class="spinner"></span>Detecting job…', false);
    const { aiConfig } = await chrome.storage.local.get('aiConfig');

    if (!aiConfig?.apiKey) {
      document.getElementById('jobTitle').textContent = 'No API key — open Settings';
      document.getElementById('jobMeta').textContent = '';
      clearStatus();
      return;
    }

    const res = await chrome.runtime.sendMessage({
      type: 'PARSE_JOB_PAGE',
      payload: { pageText, aiConfig },
    });

    if (res.error) {
      document.getElementById('jobTitle').textContent = 'Parse error';
      document.getElementById('jobMeta').textContent = res.error;
      clearStatus();
      return;
    }

    jobInfo = res.result;
    jobInfo.rawText = pageText;
    console.log('[CV Tailor] parsed job:', jobInfo);

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
  }
}

async function generateCV() {
  const btn = document.getElementById('generateBtn');
  btn.disabled = true;
  setStatus('<span class="spinner"></span>Generating…', false);
  document.getElementById('results').classList.remove('visible');

  try {
    const { profile, aiConfig } = await chrome.storage.local.get(['profile', 'aiConfig']);

    if (!aiConfig?.apiKey) {
      setStatus('No API key configured. Open Settings.', true);
      return;
    }

    if (!jobInfo?.title) {
      setStatus('No job detected. Open a job posting page first.', true);
      return;
    }

    // FORM FILLING — halted
    // cachedFields = null;
    // cachedAiAnswers = null;
    const [res] = await Promise.all([
      chrome.runtime.sendMessage({
        type: 'GENERATE_CV',
        payload: {
          userProfile: profile,
          jobInfo,
          aiConfig,
          mode: generationMode,
        },
      }),
      // FORM FILLING — halted
      // chrome.tabs.sendMessage(currentTab.id, { type: 'COLLECT_FIELDS' })
      //   .then(async fields => {
      //     cachedFields = fields;
      //     if (!fields?.length) return;
      //     const aiRes = await chrome.runtime.sendMessage({
      //       type: 'AI_FILL_FORM',
      //       payload: { fields, profile, jobTitle: jobInfo?.title, aiConfig },
      //     });
      //     if (!aiRes.error) cachedAiAnswers = aiRes.answers;
      //   })
      //   .catch(() => {}),
      Promise.resolve(),
    ]);

    if (res.error) {
      setStatus(res.error, true);
      return;
    }

    cvResult = res.result;
    renderResults(cvResult);
    document.getElementById('generateSection').style.display = 'none';
    clearStatus();

    // FORM FILLING — halted
    // if (aiConfig?.autofill) fillForm();

    await chrome.storage.local.set({
      cv_tailor_preview: {
        result: cvResult,
        profile,
        jobTitle: jobInfo?.title,
        jobCompany: jobInfo?.company,
        mode: generationMode,
        generatedAt: new Date().toISOString(),
      },
    });
  } catch (err) {
    setStatus(err.message, true);
  } finally {
    btn.disabled = false;
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
}

// FORM FILLING — halted
// async function fillForm() {
//   if (!cvResult) return;
//   const { profile, aiConfig } = await chrome.storage.local.get(['profile', 'aiConfig']);
//   try {
//     setStatus('Filling known fields…');
//     await chrome.tabs.sendMessage(currentTab.id, {
//       type: 'FILL_FORM',
//       payload: {
//         personal: profile?.personal || {},
//         cvResult,
//         cvPdfBase64: profile?.cvPdfBase64 || null,
//         cvFileName: profile?.cvFileName || null,
//       },
//     });
//     let answers = cachedAiAnswers;
//     cachedAiAnswers = null;
//     if (!answers) {
//       setStatus('Asking AI for remaining fields…');
//       let fields = cachedFields;
//       if (!fields) fields = await chrome.tabs.sendMessage(currentTab.id, { type: 'COLLECT_FIELDS' });
//       cachedFields = null;
//       if (fields?.length) {
//         const res = await chrome.runtime.sendMessage({
//           type: 'AI_FILL_FORM',
//           payload: { fields, profile, jobTitle: jobInfo?.title, aiConfig },
//         });
//         if (res.error) {
//           setStatus('Partial fill — AI error: ' + res.error, true);
//           setTimeout(clearStatus, 3000);
//           return;
//         }
//         answers = res.answers || {};
//       }
//     }
//     if (answers) {
//       await chrome.tabs.sendMessage(currentTab.id, { type: 'APPLY_AI_FIELDS', answers });
//     }
//     setStatus('Form filled!');
//     setTimeout(clearStatus, 2000);
//   } catch (err) {
//     setStatus('Could not fill form: ' + err.message, true);
//   }
// }

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
