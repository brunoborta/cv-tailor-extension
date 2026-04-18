async function init() {
  const { cv_tailor_preview } = await chrome.storage.local.get('cv_tailor_preview');

  if (!cv_tailor_preview?.result?.coverLetter) {
    document.getElementById('clPage').innerHTML =
      '<p style="color:#e53e3e;text-align:center;padding:40px">No cover letter generated yet. Go back and generate a CV first.</p>';
    return;
  }

  const { result, profile, jobTitle } = cv_tailor_preview;
  const p = profile?.personal || {};
  const cl = result.coverLetter;

  document.title = `Cover Letter — ${p.name || ''}`;
  document.getElementById('toolbarTitle').textContent = `Cover Letter — ${jobTitle || 'Job Application'}`;

  const paragraphs = Array.isArray(cl) ? cl : [cl];
  const contactLine2 = [p.phone, p.email].filter(Boolean).join(' • ');

  document.getElementById('clPage').innerHTML = `
    <div class="cl-header">
      <div class="cl-name">${esc(p.name || '')}</div>
      ${p.location ? `<div class="cl-location">${esc(p.location)}</div>` : ''}
      ${contactLine2 ? `<div class="cl-contact">${esc(contactLine2)}</div>` : ''}
      ${p.linkedin ? `<div class="cl-contact">${esc(p.linkedin)}</div>` : ''}
    </div>
    <hr class="cl-rule" />

    <div class="cl-body">
      <div class="cl-greeting">${esc(result.coverLetterGreeting || 'To whom it may concern,')}</div>
      ${paragraphs.map(para => `<p class="cl-para">${esc(para)}</p>`).join('')}
    </div>

    <div class="cl-closing">
      <div class="cl-sincerely">Sincerely,</div>
      <div class="cl-signature">${esc(p.name || '')}</div>
      <div class="cl-enclosure">Enclosure</div>
    </div>
  `;
}

function esc(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

document.addEventListener('DOMContentLoaded', init);
