async function init() {
  const isPrint = new URLSearchParams(location.search).has('print');

  if (isPrint) {
    document.querySelector('.toolbar').style.display = 'none';
  } else {
    let isEditing = false;
    document.getElementById('editBtn').addEventListener('click', () => {
      isEditing = !isEditing;
      const page = document.getElementById('clPage');
      page.contentEditable = isEditing ? 'true' : 'false';
      page.classList.toggle('editing', isEditing);
      const btn = document.getElementById('editBtn');
      btn.textContent = isEditing ? 'Done' : 'Edit';
      btn.classList.toggle('active', isEditing);
    });

    // Serialize current DOM (preserving any edits) into storage before opening the print tab
    document.getElementById('printBtn').addEventListener('click', () => {
      const editedHtml = document.getElementById('clPage').innerHTML;
      chrome.storage.local.set({ cv_tailor_print_cl_html: editedHtml }, () => {
        chrome.tabs.create({ url: chrome.runtime.getURL('cv-preview/cover-letter.html') + '?print=1' });
      });
    });
  }

  const { cv_tailor_preview, cv_tailor_print_cl_html } = await chrome.storage.local.get([
    'cv_tailor_preview',
    'cv_tailor_print_cl_html',
  ]);

  if (isPrint && cv_tailor_print_cl_html) {
    document.getElementById('clPage').innerHTML = cv_tailor_print_cl_html;
    chrome.storage.local.remove('cv_tailor_print_cl_html');
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

  if (isPrint) {
    // MV3 blocks window.print() from chrome-extension:// pages via inline handlers (CSP) and
    // also blocks it when called directly on the preview tab. Workaround: open a dedicated
    // ?print=1 tab via chrome.runtime.getURL so the call comes from a proper script context,
    // then close this tab once the print dialog is dismissed.
    window.addEventListener('afterprint', () => window.close());
    window.print();
  }
}

function esc(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

document.addEventListener('DOMContentLoaded', init);
