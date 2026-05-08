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

const JSON_MODE_PROVIDERS = new Set(['openai', 'groq', 'deepseek', 'gemini']);

export async function callAI(prompts, config) {
  return config.provider === 'claude'
    ? callClaude(prompts, config)
    : callOpenAICompatible(prompts, config);
}

async function callOpenAICompatible(prompts, config) {
  const url = config.baseUrl || PROVIDER_ENDPOINTS[config.provider];
  if (!url) throw new Error(`Unknown provider: ${config.provider}`);

  const body = {
    model: config.model || DEFAULT_MODELS[config.provider],
    messages: [
      { role: 'system', content: prompts.system },
      { role: 'user', content: prompts.user },
    ],
    temperature: prompts.temperature ?? 0.7,
  };
  if (JSON_MODE_PROVIDERS.has(config.provider)) {
    body.response_format = { type: 'json_object' };
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errBody = await res.text();
    let msg;
    try { msg = JSON.parse(errBody)?.error?.message; } catch {}
    throw new Error(`AI API error ${res.status}: ${msg || errBody}`);
  }

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error('Empty response from AI');
  return parseJSON(content);
}

async function callClaude(prompts, config) {
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
      temperature: prompts.temperature ?? 0.7,
      system: prompts.system,
      messages: [{ role: 'user', content: prompts.user }],
    }),
  });

  if (!res.ok) {
    const errBody = await res.text();
    let msg;
    try { msg = JSON.parse(errBody)?.error?.message; } catch {}
    throw new Error(`Claude API error ${res.status}: ${msg || errBody}`);
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
