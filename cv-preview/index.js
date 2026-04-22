async function init() {
  const isPrint = new URLSearchParams(location.search).has('print');

  if (isPrint) {
    document.querySelector('.toolbar').style.display = 'none';
  } else {
    let isEditing = false;
    document.getElementById('editBtn').addEventListener('click', () => {
      isEditing = !isEditing;
      const page = document.querySelector('.opt-page');
      if (page) page.contentEditable = isEditing ? 'true' : 'false';
      document.getElementById('cvContainer').classList.toggle('editing', isEditing);
      const btn = document.getElementById('editBtn');
      btn.textContent = isEditing ? 'Done' : 'Edit';
      btn.classList.toggle('active', isEditing);
    });

    // Serialize current DOM (preserving any edits) into storage before opening the print tab
    document.getElementById('printBtn').addEventListener('click', () => {
      const editedHtml = document.getElementById('cvContainer').innerHTML;
      chrome.storage.local.set({ cv_tailor_print_html: editedHtml }, () => {
        chrome.tabs.create({ url: chrome.runtime.getURL('cv-preview/index.html') + '?print=1' });
      });
    });
  }

  const { cv_tailor_preview, cv_tailor_print_html } = await chrome.storage.local.get([
    'cv_tailor_preview',
    'cv_tailor_print_html',
  ]);

  if (isPrint && cv_tailor_print_html) {
    document.getElementById('cvContainer').innerHTML = cv_tailor_print_html;
    chrome.storage.local.remove('cv_tailor_print_html');
    const { jobTitle, jobCompany } = cv_tailor_preview || {};
    document.title = ['CV', jobCompany, jobTitle].filter(Boolean).join(' - ');
  } else {
    if (!cv_tailor_preview) {
      document.getElementById('cvContainer').innerHTML =
        '<p style="font-family:sans-serif;color:#e53e3e;text-align:center;padding:40px;background:white;width:210mm;margin:0 auto">No CV generated yet. Go back and click "Generate Tailored CV" first.</p>';
      return;
    }

    const { result, profile, jobTitle, jobCompany, mode } = cv_tailor_preview;
    const personal = profile?.personal || {};

    document.title = isPrint
      ? ['CV', jobCompany, jobTitle].filter(Boolean).join(' - ')
      : `CV — ${personal.name || 'Preview'}`;
    document.getElementById('toolbarTitle').textContent =
      `${mode === 'optimize' ? 'ATS Optimize' : 'From Scratch'} — ${jobTitle || 'Job Application'}`;

    document.getElementById('cvContainer').innerHTML = renderCV(result, personal);
  }

  if (isPrint) {
    // MV3 blocks window.print() from chrome-extension:// pages via inline handlers (CSP) and
    // also blocks it when called directly on the preview tab. Workaround: open a dedicated
    // ?print=1 tab via chrome.runtime.getURL so the call comes from a proper script context,
    // then close this tab once the print dialog is dismissed.
    window.addEventListener('afterprint', () => window.close());
    window.print();
  }
}

function renderCV(cvData, personal) {
  const contactLine = [personal.location, personal.phone, personal.email].filter(Boolean).join(' • ');
  const summaryParas = Array.isArray(cvData.summary) ? cvData.summary : [cvData.summary].filter(Boolean);

  const skillsHtml = (cvData.skills || []).length
    ? `<div class="opt-section-title">Skills</div>
       <div class="opt-skills-flat">${cvData.skills.map(skill => `<span class="opt-skill-chip">${esc(skill)}</span>`).join('')}</div>
       <hr class="opt-rule" />`
    : '';

  const experienceHtml = (cvData.experience || []).map(job => `
    <div class="opt-job">
      <div class="opt-job-header">
        <div>
          <span class="opt-job-role">${esc(job.role)}</span>
          <span class="opt-job-period">(${esc(job.period)})</span>
        </div>
        <div class="opt-job-company">${esc(job.company)}</div>
      </div>
      ${job.description ? `<div class="opt-job-desc">${esc(job.description)}</div>` : ''}
      ${job.bullets?.length ? `<ul class="opt-bullets">${job.bullets.map(bullet => `<li>${esc(bullet)}</li>`).join('')}</ul>` : ''}
    </div>`).join('');

  const educationHtml = (cvData.education || []).map(entry => `
    <div class="opt-edu-entry">
      <div class="opt-edu-degree">${esc(entry.degree)}</div>
      <div class="opt-edu-inst">${esc(entry.institution)}</div>
    </div>`).join('');

  const languagesHtml = (cvData.languages || []).join(' • ');

  return `
    <div class="page">
      <div class="opt-page">

        <div class="opt-header">
          <div class="opt-name">${esc(personal.name || '')}</div>
          ${cvData.title ? `<div class="opt-title">${esc(cvData.title)}</div>` : ''}
          ${personal.linkedin ? `<div class="opt-contact">${esc(personal.linkedin)}</div>` : ''}
          ${contactLine ? `<div class="opt-contact">${esc(contactLine)}</div>` : ''}
        </div>

        <hr class="opt-rule" />

        ${summaryParas.length ? `
        <div class="opt-section-title">Summary</div>
        <div class="opt-summary">${summaryParas.map(para => `<p>${esc(para)}</p>`).join('')}</div>
        <hr class="opt-rule" />` : ''}

        ${skillsHtml}

        ${experienceHtml ? `
        <div class="opt-section-title">Professional Experience</div>
        ${experienceHtml}
        <hr class="opt-rule" />` : ''}

        ${educationHtml ? `
        <div class="opt-section-title">Education</div>
        ${educationHtml}` : ''}

        ${languagesHtml ? `
        <hr class="opt-rule" />
        <div class="opt-section-title">Languages</div>
        <div class="opt-langs">${languagesHtml}</div>` : ''}

      </div>
    </div>`;
}

function esc(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

document.addEventListener('DOMContentLoaded', init);
