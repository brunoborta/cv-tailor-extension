chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'GET_JOB_INFO') {
    sendResponse(getJobInfo());
    return true;
  }
});

const STRIP_SELECTOR = [
  'nav', 'header', 'footer', 'aside',
  '[role=navigation]', '[role=banner]', '[role=contentinfo]', '[role=complementary]',
  'button', 'form', 'iframe', 'noscript',
].join(',');

function getJobInfo() {
  const root =
    document.querySelector('main') ||
    document.querySelector('article') ||
    document.body;

  const clone = root.cloneNode(true);
  clone.querySelectorAll(STRIP_SELECTOR).forEach(el => el.remove());

  const raw = clone.innerText || '';
  const lines = raw.split('\n');
  const out = [];
  let prev = '';
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      if (prev !== '') out.push('');
      prev = '';
      continue;
    }
    if (trimmed === prev) continue;
    out.push(trimmed);
    prev = trimmed;
  }

  return { pageText: out.join('\n').trim() };
}
