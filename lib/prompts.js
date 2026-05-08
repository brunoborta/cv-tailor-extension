// profile: { personal: { name, firstName, lastName, email, phone, phoneCountryCode, phoneLocal, location, linkedin, hearAboutUs }, languages: string[], cvText: string, cvFileName: string, cvPdfBase64: string }
// jobInfo: { company: string, title: string, description: string, objectives: string, requirements: string[], niceToHave: string[], values: string[], rawText: string }
// aiConfig: { provider: 'deepseek'|'groq'|'openai'|'claude'|'custom', apiKey: string, model: string, baseUrl?: string, outputLanguage: string, autofill: boolean }
// cvResult: { title: string, summary: string[], skills: string[], experience: [{ role, company, period, description, bullets: string[] }], education: [{ degree, institution }], languages: string[], coverLetterGreeting: string, coverLetter: string[] }

export function buildParseJobPrompts(pageText) {
  return {
    system: `You are a job posting parser. Extract structured information from a job posting page. Return ONLY valid JSON, no markdown, no explanation.`,
    user: `This is the full text of a job posting page. Extract the following fields:

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
- Extract only what is actually written — do not invent or infer`,
  };
}

export function buildCVPrompts(userProfile, jobInfo, aiConfig, mode) {
  const lang = aiConfig.outputLanguage || 'auto';
  const langInstruction = lang === 'auto'
    ? 'Detect the language from the job description and write ALL output fields in that same language.'
    : `Write ALL output fields strictly in ${lang}.`;

  const hasCv = Boolean(userProfile?.cvText?.trim());

  let system;
  if (mode === 'optimize') {
    system = `You are a professional CV editor. Your ONLY job is to rewrite the candidate's existing CV to better match this job posting. You rephrase and reorder — you do NOT add skills, experience, or achievements that are not already in the CV. Return ONLY valid JSON. ${langInstruction}`;
  } else if (hasCv) {
    system = `You are a career transition specialist. Your job is to find genuine transferable skills in the candidate's ACTUAL background and reframe their real experience for a new role. You never invent jobs, credentials, or skills not present in the background. Return ONLY valid JSON. ${langInstruction}`;
  } else {
    system = `You are helping someone with no formal CV apply for a job. You may only use universal skills any person can reasonably have and common-sense skills specific to this job type. You never invent professional experience or specialised knowledge. Return ONLY valid JSON. ${langInstruction}`;
  }

  const user = mode === 'optimize'
    ? buildOptimizePrompt(userProfile, jobInfo)
    : buildScratchPrompt(userProfile, jobInfo, hasCv);

  return { system, user };
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
${jobInfo.description || ''}
${objectives}${requirements}${niceToHave}${values}`;
}

function buildOptimizePrompt(profile, jobInfo) {
  const langRule = profile.languages?.length
    ? `use EXACTLY these and no others: ${profile.languages.join(', ')}`
    : 'extract from the CV text; if none found, return []';

  return `${buildJobSection(jobInfo)}

CANDIDATE'S CURRENT CV:
${profile.cvText || ''}

Your task: rewrite the candidate's existing CV to better match this job posting. For each job in the CV, scan the requirements and description above and ask: "does any part of what this person actually did in this role address a requirement here?" Surface every match in the bullets — even non-obvious ones. You are an editor, not an inventor.

Return this exact JSON (no markdown, no explanation):
{
  "title": "exact job title from the posting",
  "summary": [
    "Rewrite the candidate's actual summary using keywords from this job. Only claim what is demonstrated in the CV.",
    "Second paragraph if the original had one — otherwise omit this entry"
  ],
  "skills": ["skill actually present in the CV, using the job posting's exact keyword variant where applicable"],
  "experience": [
    {
      "role": "Job Title — copy exactly from CV",
      "company": "Company Name — copy exactly from CV",
      "period": "YYYY – YYYY — copy exactly from CV",
      "description": "Rewrite the role description using job keywords, but only if the underlying work is the same",
      "bullets": ["Cross-reference the requirements above. For each existing bullet that speaks to a requirement, rewrite it using that requirement's exact keywords. Bullets with zero relevance to this role can be dropped."]
    }
  ],
  "education": [
    { "degree": "Degree — copy from CV", "institution": "Institution — copy from CV" }
  ],
  "languages": ["Language (Level)"],
  "coverLetterGreeting": "Dear ${jobInfo.company ? jobInfo.company + ' Team,' : '[Company] Team,'}",
  "coverLetter": [
    "I am writing to apply for the [exact job title] position at [company name]. [One sentence: who you are based on the CV.]",
    "In my [X] years of experience in [actual field from CV], I have [2-3 specific requirements from the job that the CV actually demonstrates — use real examples from the CV].",
    "[One concrete achievement from the CV that is most relevant. Numbers from the CV if available.]",
    "I would welcome the opportunity to discuss how my background aligns with your needs. I am available immediately and look forward to hearing from you."
  ]
}

STRICT RULES — violation makes the output useless:
- Include EVERY job from the CV — do not skip, merge, or reorder positions
- skills[]: ONLY skills explicitly present in the CV. If a job requirement is not in the CV, leave it out. Do NOT infer or assume skills.
- summary[]: do NOT claim expertise in anything not demonstrated in the CV
- experience bullets: rewrite phrasing only — do not add new achievements or responsibilities
- NEVER add a skill, technology, or achievement that is not in the CV
- languages[]: ${langRule}
- coverLetterGreeting MUST use "${jobInfo.company || 'the company name'}"
- coverLetter[0] MUST mention the exact job title and "${jobInfo.company || 'the company name'}"`;
}

function buildScratchPrompt(profile, jobInfo, hasCv) {
  const langRule = profile.languages?.length
    ? `use EXACTLY these and no others: ${profile.languages.join(', ')}`
    : 'extract from background text; if none found, return []';

  if (!hasCv) {
    return `${buildJobSection(jobInfo)}

APPLICANT NAME: ${profile.personal?.name || ''}

This person has no formal CV or professional experience. Build a CV using ONLY:
1. Universal soft skills any person can honestly claim: communication, teamwork, problem-solving, time management, adaptability, attention to detail
2. Common-sense practical skills specific to this job type that require no formal training (e.g. for construction: using hand tools, following safety instructions; for retail: customer service, cash handling)

Return this exact JSON (no markdown, no explanation):
{
  "title": "exact job title from the posting",
  "summary": [
    "One honest paragraph — genuine motivation for this role and universal strengths that apply to it"
  ],
  "skills": ["universal or common-sense skill for this job type — 6 to 8 items max"],
  "experience": [],
  "education": [],
  "languages": ["Language (Level)"],
  "coverLetterGreeting": "Dear ${jobInfo.company ? jobInfo.company + ' Team,' : '[Company] Team,'}",
  "coverLetter": [
    "I am writing to apply for the [exact job title] position at [company name]. [One sentence: genuine motivation for this specific role.]",
    "While I am at the beginning of my career, I bring [2-3 honest universal strengths that genuinely apply to this job type]. I am a quick learner and committed to delivering quality work.",
    "I would welcome the opportunity to grow with your team and prove my value through action. I am available immediately and look forward to hearing from you."
  ]
}

STRICT RULES:
- experience[] MUST be empty — do not invent jobs, internships, or freelance work
- education[] MUST be empty unless explicitly provided above
- skills[]: ONLY universal soft skills + common-sense practical skills for this job type. No technical skills, certifications, or domain expertise.
- summary[]: no claimed expertise, no invented background
- languages[]: ${langRule}
- coverLetterGreeting MUST use "${jobInfo.company || 'the company name'}"
- coverLetter[0] MUST mention the exact job title and "${jobInfo.company || 'the company name'}"`;
  }

  const backgroundLanguages = profile.languages?.length
    ? `Languages: ${profile.languages.join(', ')}\n`
    : '';

  return `${buildJobSection(jobInfo)}

MY BACKGROUND:
Name: ${profile.personal?.name || ''}
${backgroundLanguages}${profile.cvText || ''}

Your task: for each job in MY BACKGROUND, scan the requirements and description above and ask: "does any part of what this person actually did in this role — even indirectly — address a requirement here?" The connection doesn't need to be obvious. A developer who managed a team can speak to coordination requirements. A teacher who handled budgets can speak to financial planning. Surface every genuine overlap in the bullets. Do not invent anything not present in MY BACKGROUND.

Return this exact JSON (no markdown, no explanation):
{
  "title": "exact job title from the posting",
  "summary": [
    "One paragraph — who I am based on my actual background, and how my real skills connect to this specific role"
  ],
  "skills": ["skill genuinely present in MY BACKGROUND that is relevant to this job — use job posting keywords where applicable"],
  "experience": [
    {
      "role": "Job Title — copy from MY BACKGROUND",
      "company": "Company Name — copy from MY BACKGROUND",
      "period": "YYYY – YYYY — copy from MY BACKGROUND",
      "description": "Reframe this role in terms of what transfers to the target job — same underlying work, different angle",
      "bullets": ["Transferable achievement or responsibility — facts from MY BACKGROUND only, phrased with job keywords"]
    }
  ],
  "education": [
    { "degree": "Degree — copy from MY BACKGROUND", "institution": "Institution — copy from MY BACKGROUND" }
  ],
  "languages": ["Language (Level)"],
  "coverLetterGreeting": "Dear ${jobInfo.company ? jobInfo.company + ' Team,' : '[Company] Team,'}",
  "coverLetter": [
    "I am writing to apply for the [exact job title] position at [company name]. [Brief intro — who you are based on actual background and genuine motivation for this role.]",
    "My background is in [actual field from MY BACKGROUND]. The skills I have built — [2-3 genuinely transferable skills that match specific requirements from the posting] — apply directly to what you are looking for.",
    "[One concrete example from MY BACKGROUND most relevant to this job. Specific, not generic.]",
    "I am eager to bring my experience to [company name] and am available immediately. Thank you for considering my application."
  ]
}

STRICT RULES:
- Only include jobs where you found genuine transferable value for this specific role. If a job has nothing relevant to offer, omit it entirely — an irrelevant job title hurts more than it helps.
- skills[]: ONLY skills explicitly present in MY BACKGROUND. Do not add skills just because the job requires them.
- summary[]: no claimed expertise in anything not demonstrated in MY BACKGROUND
- experience bullets: transferable framing only — same real facts, different angle. No new achievements.
- NEVER add a skill, technology, credential, or achievement not in MY BACKGROUND
- languages[]: ${langRule}
- coverLetterGreeting MUST use "${jobInfo.company || 'the company name'}"
- coverLetter[0] MUST mention the exact job title and "${jobInfo.company || 'the company name'}"`;
}
