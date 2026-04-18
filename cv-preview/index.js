async function init() {
  const { cv_tailor_preview } = await chrome.storage.local.get('cv_tailor_preview');

  if (!cv_tailor_preview) {
    document.getElementById('cvContainer').innerHTML =
      '<p style="font-family:sans-serif;color:#e53e3e;text-align:center;padding:40px;background:white;width:210mm;margin:0 auto">No CV generated yet. Go back and click "Generate Tailored CV" first.</p>';
    return;
  }

  const { result, profile, jobTitle, mode } = cv_tailor_preview;
  const p = profile?.personal || {};

  document.title = `CV — ${p.name || 'Preview'}`;
  document.getElementById('toolbarTitle').textContent = `${mode === 'optimize' ? 'ATS Optimize' : 'From Scratch'} — ${jobTitle || 'Job Application'}`;

  const html = mode === 'optimize'
    ? renderOptimize(result, p)
    : renderScratch(result, p);

  document.getElementById('cvContainer').innerHTML = html;
}

// ─── OPTIMIZE TEMPLATE ────────────────────────────────────────────────────────

function renderOptimize(r, p) {
  const contactLine = [p.location, p.phone, p.email].filter(Boolean).join(' • ');
  const summaryParas = Array.isArray(r.summary) ? r.summary : [r.summary].filter(Boolean);

  const skillsRows = Object.entries(r.technicalSkills || {}).map(([cat, skills]) => `
    <tr>
      <td class="opt-skills-cat">${esc(cat)}:</td>
      <td>${esc(skills.join(', '))}</td>
    </tr>`).join('');

  const experienceHtml = (r.experience || []).map(job => `
    <div class="opt-job">
      <div class="opt-job-header">
        <div>
          <span class="opt-job-role">${esc(job.role)}</span>
          <span class="opt-job-period">(${esc(job.period)})</span>
        </div>
        <div class="opt-job-company">${esc(job.company)}</div>
      </div>
      ${job.description ? `<div class="opt-job-desc">${esc(job.description)}</div>` : ''}
      ${job.bullets?.length ? `<ul class="opt-bullets">${job.bullets.map(b => `<li>${esc(b)}</li>`).join('')}</ul>` : ''}
      ${job.achievements?.length ? `
        <div class="opt-achievements-label">Key Achievements:</div>
        <ul class="opt-bullets">${job.achievements.map(a => `<li>${esc(a)}</li>`).join('')}</ul>
      ` : ''}
    </div>`).join('');

  const educationHtml = (r.education || []).map(e => `
    <div class="opt-edu-entry">
      <div class="opt-edu-degree">${esc(e.degree)}</div>
      <div class="opt-edu-inst">${esc(e.institution)}</div>
    </div>`).join('');

  const langsHtml = (r.languages || []).join(' • ');

  return `
    <div class="page">
      <div class="opt-page">
        <div class="opt-header">
          <div class="opt-name">${esc(p.name || '')}</div>
          ${r.title ? `<div class="opt-title">${esc(r.title)}</div>` : ''}
          ${contactLine ? `<div class="opt-contact">${esc(contactLine)}</div>` : ''}
        </div>

        <hr class="opt-rule" />

        ${summaryParas.length ? `
        <div class="opt-section-title">Summary</div>
        <div class="opt-summary">
          ${summaryParas.map(p => `<p>${esc(p)}</p>`).join('')}
        </div>
        <hr class="opt-rule" />` : ''}

        ${skillsRows ? `
        <div class="opt-section-title">Technical Skills</div>
        <table class="opt-skills-table"><tbody>${skillsRows}</tbody></table>
        <hr class="opt-rule" />` : ''}

        ${experienceHtml ? `
        <div class="opt-section-title">Professional Experience</div>
        ${experienceHtml}
        <hr class="opt-rule" />` : ''}

        ${educationHtml ? `
        <div class="opt-section-title">Education / Credentials</div>
        ${educationHtml}` : ''}

        ${langsHtml ? `
        <hr class="opt-rule" />
        <div class="opt-section-title">Languages</div>
        <div class="opt-langs">${langsHtml}</div>` : ''}


      </div>
    </div>`;
}

// ─── SCRATCH TEMPLATE ─────────────────────────────────────────────────────────

function renderScratch(r, p) {
  const contactHtml = [p.phone, p.email].filter(Boolean)
    .map(v => `<strong>${esc(v)}</strong>`).join('') +
    [p.location].filter(Boolean).map(v => `<span>${esc(v)}</span>`).join('');

  const experienceHtml = (r.experience || []).map(job => `
    <div class="scr-job">
      <div class="scr-job-role">${esc(job.role)}</div>
      <div class="scr-job-period">${esc(job.period)}</div>
      <div class="scr-job-desc">${esc(job.description)}</div>
    </div>`).join('');

  const educationHtml = (r.education || []).map(e => `
    <div class="scr-edu-entry">
      <div class="scr-edu-degree">${esc(e.degree)}</div>
      <div class="scr-edu-inst">${esc(e.institution)}</div>
    </div>`).join('');

  const practicalHtml = (r.practicalExperience || []).map(item => `<li>${esc(item)}</li>`).join('');

  const skillsHtml = (r.skills || []).map(s => `<div class="scr-skill">${esc(s)}</div>`).join('');

  const langsHtml = (r.languages || []).map(l => {
    const name = typeof l === 'string' ? l : l.name;
    const level = typeof l === 'string' ? '' : l.level;
    const note = typeof l === 'string' ? '' : l.note;
    return `
      <div class="scr-lang">
        <div class="scr-lang-name">${esc(name)} ${level ? `<span class="scr-lang-level">(${esc(level)})</span>` : ''}</div>
        ${note ? `<div class="scr-lang-note">${esc(note)}</div>` : ''}
      </div>`;
  }).join('');

  return `
    <div class="page">
      <div class="scr-page">
        <div class="scr-header">
          <div class="scr-name">${esc(p.name || '')}</div>
          <div class="scr-contact">${contactHtml}</div>
        </div>

        <div class="scr-body">
          <div class="scr-left">
            ${experienceHtml ? `
            <div class="scr-section-title">Experience</div>
            ${experienceHtml}` : ''}

            ${educationHtml ? `
            <div class="scr-section-title">Education</div>
            ${educationHtml}` : ''}

            ${practicalHtml ? `
            <div class="scr-section-title">Practical Experience</div>
            <ul class="scr-practical">${practicalHtml}</ul>` : ''}

          </div>

          <div class="scr-right">
            ${skillsHtml ? `
            <div class="scr-section-title">Skills</div>
            ${skillsHtml}` : ''}

            ${langsHtml ? `
            <div class="scr-section-title">Languages</div>
            ${langsHtml}` : ''}
          </div>
        </div>
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
