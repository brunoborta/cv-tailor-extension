import { callAI } from './lib/ai-client.js';
import { buildParseJobPrompts, buildCVPrompts } from './lib/prompts.js';

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

async function parseJobPage({ pageText, aiConfig }) {
  const { system, user } = buildParseJobPrompts(pageText);
  return callAI(system, user, aiConfig);
}

async function handleGenerateCV({ userProfile, jobInfo, aiConfig, mode }) {
  const { system, user } = buildCVPrompts(userProfile, jobInfo, aiConfig, mode);
  return callAI(system, user, aiConfig);
}
