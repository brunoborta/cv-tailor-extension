const PROVIDER_ENDPOINTS = {
  deepseek: 'https://api.deepseek.com/v1/chat/completions',
  groq: 'https://api.groq.com/openai/v1/chat/completions',
  openai: 'https://api.openai.com/v1/chat/completions',
};

const DEFAULT_MODELS = {
  deepseek: 'deepseek-chat',
  groq: 'llama-3.3-70b-versatile',
  openai: 'gpt-4o-mini',
  claude: 'claude-haiku-4-5-20251001',
};

// profile: { personal: { name, firstName, lastName, email, phone, phoneCountryCode, phoneLocal, location, linkedin, hearAboutUs }, languages: string[], cvText: string, cvFileName: string, cvPdfBase64: string }
// jobInfo: { company: string, title: string, description: string, objectives: string, requirements: string[], niceToHave: string[], values: string[], rawText: string }
// aiConfig: { provider: 'deepseek'|'groq'|'openai'|'claude'|'custom', apiKey: string, model: string, baseUrl?: string, outputLanguage: string, autofill: boolean }
// cvResult: { title: string, summary: string[], skills: string[], experience: [{ role, company, period, description, bullets: string[] }], education: [{ degree, institution }], languages: string[], coverLetterGreeting: string, coverLetter: string[] }

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
  const systemPrompt = `You are a job posting parser. Extract structured information from a job posting page. Return ONLY valid JSON, no markdown, no explanation.`;

  const userPrompt = `This is the full text of a job posting page. Extract the following fields:

PAGE TEXT:
${pageText}

Return this exact JSON:
{
  "company": "Company name",
  "title": "Exact job title",
  "description": "Full job description — what the role does day to day",
  "objectives": "What this role is expected to achieve or deliver",
  "requirements": ["Required skill or experience", "..."],
  "niceToHave": ["Nice-to-have skill", "..."],
  "values": ["Company value or culture trait", "..."]
}

Rules:
- If a field is not found on the page, use an empty string or empty array
- "description" and "objectives" should be complete sentences, not truncated
- "company" must be the hiring company name, not a recruiter or job board name
- Extract only what is actually written — do not invent or infer`;

  if (aiConfig.provider === 'claude') return callClaude(systemPrompt, userPrompt, aiConfig);
  return callOpenAICompatible(systemPrompt, userPrompt, aiConfig);
}

async function handleGenerateCV({ userProfile, jobInfo, aiConfig, mode }) {
  console.log('[CV Tailor] generating CV');
  console.log('  mode:', mode);
  console.log('  company:', jobInfo?.company);
  console.log('  title:', jobInfo?.title);
  console.log('  requirements:', jobInfo?.requirements?.length);
  console.log('  cvText length:', userProfile?.cvText?.length);

  const lang = aiConfig.outputLanguage || 'auto';
  const langInstruction = lang === 'auto'
    ? 'Detect the language from the job description and write ALL output fields in that same language.'
    : `Write ALL output fields strictly in ${lang}.`;

  const systemPrompt = mode === 'optimize'
    ? `You are an expert CV writer and ATS specialist. Rewrite the candidate's CV to match the job description as closely as possible. Use exact keywords from the job posting. Do NOT invent experience. Return ONLY valid JSON. ${langInstruction}`
    : `You are an expert CV writer. Using the candidate's real background, build a CV that bridges their skills to the target job. Be honest — only use what they actually have, but frame it to show relevance. Return ONLY valid JSON. ${langInstruction}`;

  const userPrompt = mode === 'optimize'
    ? buildOptimizePrompt(userProfile, jobInfo)
    : buildScratchPrompt(userProfile, jobInfo);

  console.log('[CV Tailor] prompt:\n', userPrompt);

  const result = aiConfig.provider === 'claude'
    ? await callClaude(systemPrompt, userPrompt, aiConfig)
    : await callOpenAICompatible(systemPrompt, userPrompt, aiConfig);

  console.log('[CV Tailor] CV result:\n', JSON.stringify(result, null, 2));
  return result;
}

function buildJobSection(jobInfo) {
  const requirements = jobInfo.requirements?.length
    ? `\nREQUIREMENTS:\n${jobInfo.requirements.map(r => `- ${r}`).join('\n')}`
    : '';
  const niceToHave = jobInfo.niceToHave?.length
    ? `\nNICE TO HAVE:\n${jobInfo.niceToHave.map(r => `- ${r}`).join('\n')}`
    : '';
  const objectives = jobInfo.objectives
    ? `\nROLE OBJECTIVES:\n${jobInfo.objectives}`
    : '';
  const values = jobInfo.values?.length
    ? `\nCOMPANY VALUES:\n${jobInfo.values.map(v => `- ${v}`).join('\n')}`
    : '';

  return `COMPANY: ${jobInfo.company || ''}
ROLE: ${jobInfo.title || ''}

DESCRIPTION:
${jobInfo.description || jobInfo.rawText || ''}
${objectives}${requirements}${niceToHave}${values}

FULL PAGE TEXT (extra context):
${jobInfo.rawText || ''}`;
}

function buildOptimizePrompt(profile, jobInfo) {
  const langRule = profile.languages?.length
    ? `use EXACTLY these and no others: ${profile.languages.join(', ')}`
    : 'extract from the CV text; if none found, return []';

  return `${buildJobSection(jobInfo)}

CANDIDATE'S CURRENT CV:
${profile.cvText || ''}

Your task: rewrite the candidate's CV to target this specific job. Keep every job entry. Inject keywords from the requirements and description into bullets and summary. Do not fabricate anything.

Return this exact JSON (no markdown, no explanation):
{
  "title": "exact job title from the posting",
  "summary": [
    "First paragraph — rewritten with keywords from this job description",
    "Second paragraph — if the original CV had one, keep it rewritten; otherwise omit"
  ],
  "skills": ["skill from job requirements", "..."],
  "experience": [
    {
      "role": "Job Title",
      "company": "Company Name",
      "period": "YYYY – YYYY",
      "description": "One sentence describing the role, rewritten with job keywords",
      "bullets": ["Achievement or responsibility rewritten with ATS keywords", "..."]
    }
  ],
  "education": [
    { "degree": "Degree", "institution": "Institution" }
  ],
  "languages": ["Language (Level)"],
  "coverLetterGreeting": "Dear ${jobInfo.company ? jobInfo.company + ' Team,' : '[Company] Team,'}",
  "coverLetter": [
    "I am writing to apply for the [exact job title] position at [company name]. [Who you are in one sentence, why this role.]",
    "In my [X] years as a developer, I have [pick 2-3 specific requirements from the job and show exactly how the candidate's experience meets them].",
    "[Specific achievement with numbers if available. Why you are a strong fit for their stack/context.]",
    "I would welcome the opportunity to discuss how my background aligns with your needs. I am available immediately and look forward to hearing from you."
  ]
}

Rules:
- Include EVERY job from the CV — do not skip any position
- skills[]: prioritise exact terms from requirements[], 6-10 items
- languages[]: ${langRule}
- coverLetterGreeting MUST use "${jobInfo.company || 'the company name'}"
- coverLetter[0] MUST mention the exact job title and "${jobInfo.company || 'the company name'}"`;
}

function buildScratchPrompt(profile, jobInfo) {
  const langRule = profile.languages?.length
    ? `use EXACTLY these and no others: ${profile.languages.join(', ')}`
    : 'extract from background text; if none found, return []';

  const backgroundLanguages = profile.languages?.length
    ? `Languages: ${profile.languages.join(', ')}\n`
    : '';

  return `${buildJobSection(jobInfo)}

MY BACKGROUND:
Name: ${profile.personal?.name || ''}
${backgroundLanguages}${profile.cvText || ''}

Your task: read the job description carefully. Understand what the company needs. Then look at my background and find what is genuinely transferable or relevant. Build a CV and cover letter that honestly positions my background for this job.

Return this exact JSON (no markdown, no explanation):
{
  "title": "exact job title from the posting",
  "summary": [
    "One paragraph — who I am and how my background connects to this specific role"
  ],
  "skills": ["skill relevant to this job", "..."],
  "experience": [
    {
      "role": "Job Title",
      "company": "Company Name",
      "period": "YYYY – YYYY",
      "description": "Reframe this role in terms of what it has in common with the target job",
      "bullets": ["Transferable achievement or skill relevant to the job description", "..."]
    }
  ],
  "education": [
    { "degree": "Degree", "institution": "Institution" }
  ],
  "languages": ["Language (Level)"],
  "coverLetterGreeting": "Dear ${jobInfo.company ? jobInfo.company + ' Team,' : '[Company] Team,'}",
  "coverLetter": [
    "I am writing to apply for the [exact job title] position at [company name]. [Brief intro — who you are and genuine motivation for this role.]",
    "Although my background is in [field], the skills I have built — [list 2-3 genuinely transferable skills that match requirements] — are directly applicable to what you are looking for.",
    "[Specific example from background that is most relevant to this job. Be concrete.]",
    "I am eager to bring my skills to [company name] and am available to start immediately. Thank you for considering my application."
  ]
}

Rules:
- Only use experience from MY BACKGROUND — do not invent jobs or credentials
- skills[]: use exact keywords from requirements[], 6-10 items
- languages[]: ${langRule}
- coverLetterGreeting MUST use "${jobInfo.company || 'the company name'}"
- coverLetter[0] MUST mention the exact job title and "${jobInfo.company || 'the company name'}"`;
}

async function callOpenAICompatible(systemPrompt, userPrompt, config) {
  const url = config.baseUrl || PROVIDER_ENDPOINTS[config.provider];
  if (!url) throw new Error(`Unknown provider: ${config.provider}`);

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model || DEFAULT_MODELS[config.provider],
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.7,
    }),
  });

  if (!res.ok) throw new Error(`AI API error ${res.status}: ${await res.text()}`);

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error('Empty response from AI');
  return parseJSON(content);
}

async function callClaude(systemPrompt, userPrompt, config) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': config.apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: config.model || DEFAULT_MODELS.claude,
      max_tokens: 4096,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    }),
  });

  if (!res.ok) throw new Error(`Claude API error ${res.status}: ${await res.text()}`);

  const data = await res.json();
  const content = data.content?.[0]?.text;
  if (!content) throw new Error('Empty response from Claude');
  return parseJSON(content);
}

function parseJSON(raw) {
  const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
  try {
    return { result: JSON.parse(cleaned) };
  } catch {
    throw new Error('AI returned invalid JSON. Try again.');
  }
}
