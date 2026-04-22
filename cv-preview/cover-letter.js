async function init() {
  const isPrint = new URLSearchParams(location.search).has('print');

  if (isPrint) {
    document.querySelector('.toolbar').style.display = 'none';
  } else {
    document.getElementById('printBtn').addEventListener('click', () => {
      chrome.tabs.create({ url: chrome.runtime.getURL('cv-preview/cover-letter.html') + '?print=1' });
    });
  }

  const { cv_tailor_preview } = await chrome.storage.local.get('cv_tailor_preview');

  if (!cv_tailor_preview?.result?.coverLetter) {
    document.getElementById('clPage').innerHTML =
      '<p style="color:#e53e3e;text-align:center;padding:40px">No cover letter generated yet. Go back and generate a CV first.</p>';
    return;
  }

  const { result, profile, jobTitle } = cv_tailor_preview;
  const personal = profile?.personal || {};
  const coverLetter = result.coverLetter;

  document.title = `Cover Letter — ${personal.name || ''}`;
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
