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

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'GENERATE_CV') {
    handleGenerateCV(message.payload)
      .then(sendResponse)
      .catch(err => sendResponse({ error: err.message }));
    return true;
  }
  if (message.type === 'AI_FILL_FORM') {
    handleAiFillForm(message.payload)
      .then(sendResponse)
      .catch(err => sendResponse({ error: err.message }));
    return true;
  }
});

async function handleGenerateCV({ userProfile, jobTitle, jobDescription, aiConfig, mode }) {
  const lang = aiConfig.outputLanguage || 'auto';
  const langInstruction = lang === 'auto'
    ? 'Detect the language from the job description and write ALL output fields in that same language.'
    : `Write ALL output fields strictly in ${lang}. Do not use any other language regardless of the job description language.`;

  const systemPrompt = mode === 'optimize'
    ? `You are a professional CV writer and ATS optimization specialist. Your task is to take the user's complete CV and rewrite it to match a specific job description as closely as possible. CRITICAL RULES: (1) Preserve EVERY job entry — do not remove, merge, or skip any position. (2) Do not fabricate experience — only rewrite phrasing and keywords. (3) Inject exact keywords from the job posting into existing bullets and summaries. (4) Return ONLY valid JSON, no markdown fences, no explanation. LANGUAGE: ${langInstruction}`
    : `You are a CV writer specializing in career transitions. Create an honest, creative CV that bridges the user's background to a new field using transferable skills. Return ONLY valid JSON, no markdown fences. LANGUAGE: ${langInstruction}`;

  const userPrompt = mode === 'optimize'
    ? buildOptimizePrompt(userProfile, jobTitle, jobDescription, lang)
    : buildScratchPrompt(userProfile, jobTitle, jobDescription, lang);

  if (aiConfig.provider === 'claude') {
    return callClaude(systemPrompt, userPrompt, aiConfig);
  }
  return callOpenAICompatible(systemPrompt, userPrompt, aiConfig);
}

async function handleAiFillForm({ fields, profile, jobTitle, aiConfig }) {
  if (!fields?.length) return { answers: {} };

  const p = profile?.personal || {};
  const profileSummary = [
    p.name && `Name: ${p.name}`,
    p.location && `Location: ${p.location}`,
    p.email && `Email: ${p.email}`,
    p.phone && `Phone: ${p.phone}`,
    profile?.languages?.length && `Languages: ${profile.languages.join(', ')}`,
    profile?.cvText && `Background: ${profile.cvText.slice(0, 400)}`,
  ].filter(Boolean).join('\n');

  const systemPrompt = `You are filling out a job application form on behalf of a candidate. Return ONLY valid JSON mapping field keys to values. No explanation, no markdown fences.`;

  const userPrompt = `CANDIDATE:
${profileSummary}

JOB: ${jobTitle || 'Not specified'}

FORM FIELDS:
${JSON.stringify(fields, null, 2)}

Return a JSON object with answers for each field key.

CRITICAL RULES:
- type "select": MUST return one of the exact "value" strings from the options array — never free text
- type "radio": MUST return one of the exact "value" strings from the options array
- type "checkbox": return "true" or "false"
- type "text" / "textarea": write a concise appropriate answer
- Infer from context (e.g. location "Berlin, Germany" → EU membership questions → "true" or "Yes")
- If a select/radio has no clearly correct option, omit that field entirely
- Omit any field you cannot answer confidently

Return ONLY valid JSON: {"cvt_field_0": "value", "cvt_field_1": "value", ...}`;

  const call = aiConfig.provider === 'claude' ? callClaude : callOpenAICompatible;
  const res = await call(systemPrompt, userPrompt, aiConfig);
  return { answers: res.result };
}

function buildOptimizePrompt(profile, jobTitle, jobDescription, lang) {
  const langRule = lang === 'auto'
    ? 'Detect and match the language of the job description for ALL fields'
    : `Write every single field in ${lang}`;

  return `JOB TITLE: ${jobTitle}

JOB DESCRIPTION:
${jobDescription.slice(0, 3000)}

CANDIDATE CV:
${profile.cvText || ''}

Rewrite this CV for the job above. Return this exact JSON structure:
{
  "title": "Job title headline — adapt from the candidate's current title to best match the job posting",
  "summary": [
    "First summary paragraph — rewritten with ATS keywords from the job",
    "Second summary paragraph — keep if exists in original"
  ],
  "technicalSkills": {
    "Category Name": ["skill1", "skill2"],
    "Another Category": ["skill3", "skill4"]
  },
  "experience": [
    {
      "role": "Job Title",
      "company": "Company Name",
      "period": "YYYY to YYYY",
      "description": "One sentence italic role description — rewrite with job keywords",
      "bullets": ["Bullet rewritten with ATS keywords", "..."],
      "achievements": ["Key achievement preserved", "..."]
    }
  ],
  "education": [
    { "degree": "Degree Name", "institution": "Institution Name" }
  ],
  "languages": ["Language (Level)"],
  "coverLetterGreeting": "To whom it may concern," or "Dear [Company] Team," if company name is known,
  "coverLetter": [
    "Opening paragraph — who you are and why you're applying",
    "Middle paragraph — your most relevant experience and skills for this role",
    "Middle paragraph — specific value you bring, adaptability, leadership",
    "Closing paragraph — call to action, availability, thank you"
  ]
}

Rules:
- Include EVERY job from the original CV — do not skip any
- technicalSkills: put the most job-relevant categories first, use exact keywords from the job posting
- experience bullets: rewrite using vocabulary from the job description, keep the true meaning
- achievements: keep numbers and facts (500%, 30%, 60%) — only rephrase if needed for ATS
- CRITICAL: ${langRule}`;
}

function buildScratchPrompt(profile, jobTitle, jobDescription, lang) {
  const langRule = lang === 'auto'
    ? 'Detect and match the language of the job description for ALL fields'
    : `Write every single field in ${lang}`;

  return `JOB TITLE: ${jobTitle}

JOB DESCRIPTION:
${jobDescription.slice(0, 3000)}

MY BACKGROUND:
Name: ${profile.personal?.name || ''}
Languages: ${(profile.languages || []).join(', ')}
${profile.cvText || ''}

Create a FROM-SCRATCH CV for this job. Return this exact JSON structure:
{
  "experience": [
    {
      "role": "Job title and city",
      "period": "From YEAR or YEAR to YEAR",
      "description": "2-3 sentence description bridging real background to this role"
    }
  ],
  "education": [
    { "degree": "Degree or Certificate", "institution": "School name" }
  ],
  "practicalExperience": [
    "Relevant hands-on experience item (e.g. furniture assembly, tools, physical work)"
  ],
  "skills": [
    "Skill relevant to this job"
  ],
  "languages": [
    { "name": "Language name", "level": "Level", "note": "Optional clarification" }
  ],
  "coverLetterGreeting": "To whom it may concern," or "Dear [Company] Team," if company name is known,
  "coverLetter": [
    "Opening paragraph — motivation and connection to this specific role/field",
    "Middle paragraph — transferable skills and how they apply here",
    "Closing paragraph — enthusiasm, availability, call to action"
  ]
}

Rules:
- Bridge background creatively: programmer → any job = attention to detail, following specs, reliability
- Physical/manual jobs: include IKEA assembly, basic tools (drill, level, hammer), physical reliability
- skills[]: 4-6 items, use exact keywords from job posting
- Frame as motivated first-timer in this field
- CRITICAL: ${langRule}`;
}

async function callOpenAICompatible(systemPrompt, userPrompt, config) {
  const url = config.baseUrl || PROVIDER_ENDPOINTS[config.provider];
  if (!url) throw new Error(`Unknown provider: ${config.provider}`);

  const model = config.model || DEFAULT_MODELS[config.provider];

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.7,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`AI API error ${res.status}: ${err}`);
  }

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error('Empty response from AI');

  return parseJSON(content);
}

async function callClaude(systemPrompt, userPrompt, config) {
  const model = config.model || DEFAULT_MODELS.claude;

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': config.apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: 4096,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Claude API error ${res.status}: ${err}`);
  }

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
