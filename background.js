import { callAI } from './lib/ai-client.js';
import { buildParseJobPrompts, buildCVPrompts } from './lib/prompts.js';
import { hashText } from './lib/util.js';
import { getJobCache, setJobCache } from './lib/storage.js';

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'GENERATE_CV') {
    handleGenerateCV(message.payload)
      .then(sendResponse)
      .catch(err => sendResponse({ error: err.message }));
    return true;
  }
  if (message.type === 'PARSE_JOB_PAGE') {
    parseJobPage(message.payload)
      .then(sendResponse)
      .catch(err => sendResponse({ error: err.message }));
    return true;
  }
});

async function parseJobPage({ pageText, aiConfig, forceRefresh }) {
  const hash = await hashText(pageText);
  if (!forceRefresh) {
    const cached = await getJobCache(hash);
    if (cached) return cached;
  }

  const prompts = buildParseJobPrompts(pageText);
  const result = await callAI(prompts, aiConfig);
  await setJobCache(hash, result);
  return result;
}

async function handleGenerateCV({ userProfile, jobInfo, aiConfig, mode }) {
  const prompts = buildCVPrompts(userProfile, jobInfo, aiConfig, mode);
  return callAI(prompts, aiConfig);
}
