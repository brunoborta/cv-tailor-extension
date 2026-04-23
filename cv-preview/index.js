import { getPreview, getPrintHtml, clearPrintHtml } from '../lib/storage.js';
import { setupPreviewPage, triggerPrint } from '../lib/print-page.js';
import { esc } from '../lib/util.js';

async function init() {
  const isPrint = setupPreviewPage({
    title: 'CV Preview',
    printBtnLabel: 'Print / Save as PDF',
    contentId: 'cvContainer',
    editSelector: '.opt-page',
    storageKind: 'cv',
    htmlPath: 'cv-preview/index.html',
  });

  const [cv_tailor_preview, cv_tailor_print_html] = await Promise.all([getPreview(), getPrintHtml('cv')]);

  if (isPrint && cv_tailor_print_html) {
    document.getElementById('cvContainer').innerHTML = cv_tailor_print_html;
    clearPrintHtml('cv');
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

  if (isPrint) triggerPrint();
}

function renderCV(cvData, personal) {
  const contactLine = [personal.location, personal.phone, personal.email].filter(Boolean).join(' • ');
  const summaryParas = Array.isArray(cvData.summary) ? cvData.summary : [cvData.summary].filter(Boolean);

  const sections = [];

  if (summaryParas.length) {
    sections.push(
      `<div class="opt-section-title">Summary</div>` +
      `<div class="opt-summary">${summaryParas.map(para => `<p>${esc(para)}</p>`).join('')}</div>`
    );
  }

  if ((cvData.skills || []).length) {
    sections.push(
      `<div class="opt-section-title">Skills</div>` +
      `<div class="opt-skills-flat">${cvData.skills.map(skill => `<span class="opt-skill-chip">${esc(skill)}</span>`).join('')}</div>`
    );
  }

  const experienceItems = (cvData.experience || []).map(job => `
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

  if (experienceItems) {
    sections.push(`<div class="opt-section-title">Professional Experience</div>` + experienceItems);
  }

  const educationItems = (cvData.education || []).map(entry => `
    <div class="opt-edu-entry">
      <div class="opt-edu-degree">${esc(entry.degree)}</div>
      <div class="opt-edu-inst">${esc(entry.institution)}</div>
    </div>`).join('');

  if (educationItems) {
    sections.push(`<div class="opt-section-title">Education</div>` + educationItems);
  }

  const languagesLine = (cvData.languages || []).join(' • ');
  if (languagesLine) {
    sections.push(
      `<div class="opt-section-title">Languages</div>` +
      `<div class="opt-langs">${languagesLine}</div>`
    );
  }

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

        ${sections.join('<hr class="opt-rule" />')}

      </div>
    </div>`;
}

document.addEventListener('DOMContentLoaded', init);
