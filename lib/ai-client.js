export const PROVIDER_ENDPOINTS = {
  deepseek: 'https://api.deepseek.com/v1/chat/completions',
  groq: 'https://api.groq.com/openai/v1/chat/completions',
  openai: 'https://api.openai.com/v1/chat/completions',
  gemini: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
};

export const DEFAULT_MODELS = {
  deepseek: 'deepseek-chat',
  groq: 'llama-3.3-70b-versatile',
  openai: 'gpt-4o-mini',
  gemini: 'gemini-3.1-flash-lite-preview',
  claude: 'claude-haiku-4-5-20251001',
  custom: '',
};

export const API_KEY_HINTS = {
  deepseek: 'Get a free key at platform.deepseek.com',
  groq: 'Get a free key at console.groq.com',
  openai: 'Get a key at platform.openai.com',
  gemini: 'Get a free key at aistudio.google.com',
  claude: 'Get a key at console.anthropic.com',
  custom: 'Enter the API key for your custom provider',
};

export async function callAI(systemPrompt, userPrompt, config) {
  return config.provider === 'claude'
    ? callClaude(systemPrompt, userPrompt, config)
    : callOpenAICompatible(systemPrompt, userPrompt, config);
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

  if (!res.ok) {
    const body = await res.text();
    let msg;
    try { msg = JSON.parse(body)?.error?.message; } catch {}
    throw new Error(`AI API error ${res.status}: ${msg || body}`);
  }

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

  if (!res.ok) {
    const body = await res.text();
    let msg;
    try { msg = JSON.parse(body)?.error?.message; } catch {}
    throw new Error(`Claude API error ${res.status}: ${msg || body}`);
  }

  const data = await res.json();
  const content = data.content?.[0]?.text;
  if (!content) throw new Error('Empty response from Claude');
  return parseJSON(content);
}

function parseJSON(raw) {
  const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    throw new Error('AI returned invalid JSON. Try again.');
  }
}
