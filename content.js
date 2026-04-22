chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'GET_JOB_INFO') {
    sendResponse(getJobInfo());
    return true;
  }
});

function getJobInfo() {
  const pageText = document.body.innerText.trim();
  console.log('[CV Tailor] pageText length:', pageText.length);
  console.log('[CV Tailor] pageText preview:', pageText.slice(0, 400));
  return { pageText };
}
