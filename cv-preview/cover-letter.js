import { getPreview, getPrintHtml, clearPrintHtml } from '../lib/storage.js';
import { setupPreviewPage, triggerPrint } from '../lib/print-page.js';
import { esc } from '../lib/util.js';

async function init() {
  const isPrint = setupPreviewPage({
    title: 'Cover Letter',
    printBtnLabel: 'Save as PDF',
    contentId: 'clPage',
    editSelector: null,
    storageKind: 'cl',
    htmlPath: 'cv-preview/cover-letter.html',
  });

  const [cv_tailor_preview, cv_tailor_print_cl_html] = await Promise.all([getPreview(), getPrintHtml('cl')]);

  if (isPrint && cv_tailor_print_cl_html) {
    document.getElementById('clPage').innerHTML = cv_tailor_print_cl_html;
    clearPrintHtml('cl');
    const { jobTitle, jobCompany } = cv_tailor_preview || {};
    document.title = ['CL', jobCompany, jobTitle].filter(Boolean).join(' - ');
  } else if (!cv_tailor_preview?.result?.coverLetter) {
    document.getElementById('clPage').innerHTML =
      '<p style="color:#e53e3e;text-align:center;padding:40px">No cover letter generated yet. Go back and generate a CV first.</p>';
  } else {
    const { result, profile, jobTitle, jobCompany } = cv_tailor_preview;
    const personal = profile?.personal || {};
    const coverLetter = result.coverLetter;

    document.title = isPrint
      ? ['CL', jobCompany, jobTitle].filter(Boolean).join(' - ')
      : `Cover Letter — ${personal.name || ''}`;
    document.getElementById('toolbarTitle').textContent = `Cover Letter — ${jobTitle || 'Job Application'}`;

    const paragraphs = Array.isArray(coverLetter) ? coverLetter : [coverLetter];
    const contactLine = [personal.phone, personal.email].filter(Boolean).join(' • ');

    document.getElementById('clPage').innerHTML = `
      <div class="cl-header">
        <div class="cl-name">${esc(personal.name || '')}</div>
        ${personal.location ? `<div class="cl-location">${esc(personal.location)}</div>` : ''}
        ${contactLine ? `<div class="cl-contact">${esc(contactLine)}</div>` : ''}
        ${personal.linkedin ? `<div class="cl-contact">${esc(personal.linkedin)}</div>` : ''}
      </div>
      <hr class="cl-rule" />

      <div class="cl-body">
        <div class="cl-greeting">${esc(result.coverLetterGreeting || 'To whom it may concern,')}</div>
        ${paragraphs.map(para => `<p class="cl-para">${esc(para)}</p>`).join('')}
      </div>

      <div class="cl-closing">
        <div class="cl-sincerely">Sincerely,</div>
        <div class="cl-signature">${esc(personal.name || '')}</div>
        <div class="cl-enclosure">Enclosure</div>
      </div>
    `;
  }

  if (isPrint) triggerPrint();
}

document.addEventListener('DOMContentLoaded', init);
