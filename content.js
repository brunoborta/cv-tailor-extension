let aiFieldMap = new Map();

// ATS-specific selectors for common applicant tracking systems
const ATS_SELECTORS = {
  greenhouse: {
    title: '#app_body h1, .job__title, [class*="job-title"]',
    description: '#content, .job__description, [class*="job-description"], [class*="content--jobPost"]',
  },
  lever: {
    title: '.posting-headline h2',
    description: '.posting-description, .section-wrapper',
  },
  workable: {
    title: 'h1[data-ui="job-title"], .job-title',
    description: '[data-ui="job-description"], .job-description',
  },
  personio: {
    title: '.jb-job-title, h1.title',
    description: '.jb-job-description, .job-description-text',
  },
  smartrecruiters: {
    title: '.job-title, h1[class*="title"]',
    description: '.job-sections, [class*="job-description"]',
  },
};

const JOB_KEYWORDS = ['responsibilities', 'requirements', 'qualifications', 'aufgaben', 'anforderungen', 'stellenbeschreibung', 'what you', 'was du', 'deine aufgaben'];

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'GET_JOB_INFO') {
    sendResponse(extractJobInfo());
    return true;
  }
  if (message.type === 'FILL_FORM') {
    fillForm(message.payload);
    sendResponse({ ok: true });
    return true;
  }
  if (message.type === 'COLLECT_FIELDS') {
    sendResponse(collectFields());
    return true;
  }
  if (message.type === 'APPLY_AI_FIELDS') {
    applyAiFields(message.answers).then(() => sendResponse({ ok: true }));
    return true;
  }
});

function extractJobInfo() {
  const title = extractTitle();
  const description = extractDescription();
  return { title, description };
}

function extractTitle() {
  const titleSelectors = [
    ...Object.values(ATS_SELECTORS).map(s => s.title),
    'h1',
    '[class*="job-title"]',
    '[class*="position-title"]',
    '[data-testid*="title"]',
  ].join(', ');

  const el = document.querySelector(titleSelectors);
  if (el?.textContent?.trim()) return el.textContent.trim();

  // Fallback: <title> tag minus company name
  return document.title.split(/[-|–]/)[0].trim();
}

function extractDescription() {
  // Try ATS-specific selectors first
  for (const ats of Object.values(ATS_SELECTORS)) {
    const el = document.querySelector(ats.description);
    if (el?.textContent?.trim().length > 100) {
      return el.textContent.trim().slice(0, 4000);
    }
  }

  // Heuristic: find the largest text block containing job keywords
  const candidates = document.querySelectorAll('div, section, article');
  let best = null;
  let bestScore = 0;

  for (const el of candidates) {
    const text = el.innerText || '';
    if (text.length < 100 || text.length > 10000) continue;

    const lower = text.toLowerCase();
    const keywordMatches = JOB_KEYWORDS.filter(kw => lower.includes(kw)).length;
    const score = keywordMatches * 100 + Math.min(text.length, 2000);

    if (score > bestScore) {
      bestScore = score;
      best = text;
    }
  }

  if (best) return best.slice(0, 4000);

  // Final fallback: whole body text
  return document.body.innerText.slice(0, 4000);
}

function fillForm(data) {
  const { personal, cvResult, cvPdfBase64, cvFileName } = data;

  if (cvPdfBase64 && cvFileName) {
    const fileInputs = document.querySelectorAll('input[type="file"]');
    for (const input of fileInputs) {
      const identifier = [input.name, input.id, input.getAttribute('aria-label'), input.getAttribute('accept')]
        .filter(Boolean).join(' ').toLowerCase();
      if (identifier.includes('cv') || identifier.includes('resume') || identifier.includes('lebenslauf') ||
          identifier.includes('pdf') || !identifier) {
        try {
          const bytes = Uint8Array.from(atob(cvPdfBase64), c => c.charCodeAt(0));
          const file = new File([bytes], cvFileName, { type: 'application/pdf' });
          const dt = new DataTransfer();
          dt.items.add(file);
          input.files = dt.files;
          input.dispatchEvent(new Event('change', { bubbles: true }));
        } catch {}
        break;
      }
    }
  }

  const fieldMap = [
    { keys: ['first name', 'firstname', 'first_name', 'vorname', 'given name', 'givenname', 'preferred name', 'preferredname'], value: personal.firstName },
    { keys: ['last name', 'lastname', 'last_name', 'nachname', 'surname', 'family name', 'familyname'], value: personal.lastName },
    { keys: ['full name', 'fullname', 'full_name', 'name', 'nome'], value: [personal.firstName, personal.lastName].filter(Boolean).join(' ') || personal.name },
    { keys: ['email', 'e-mail', 'mail'], value: personal.email },
    { keys: ['country code', 'countrycode', 'country_code', 'dial code', 'dialcode', 'vorwahl', 'ländervorwahl'], value: personal.phoneCountryCode },
    { keys: ['phone', 'telefon', 'tel', 'mobile', 'handy', 'telefonnummer', 'mobil'], value: personal.phone },
    { keys: ['city', 'location', 'ort', 'stadt', 'standort', 'wohnort'], value: personal.location },
    { keys: ['linkedin'], value: personal.linkedin },
    {
      keys: ['cover', 'motivation', 'anschreiben', 'covering', 'letter', 'message', 'nachricht', 'why', 'warum'],
      value: cvResult?.coverLetter,
    },
    {
      keys: ['summary', 'about', 'uber', 'profil', 'bio'],
      value: cvResult?.summary,
    },
  ];

  const inputs = document.querySelectorAll('input, textarea, select');

  console.group('[CV Tailor] fillForm debug');
  console.log('personal payload:', JSON.stringify({ name: personal.name, firstName: personal.firstName, lastName: personal.lastName, phone: personal.phone, phoneCountryCode: personal.phoneCountryCode, phoneLocal: personal.phoneLocal }));
  for (const input of inputs) {
    const dbgId = [input.tagName, input.type, input.name, input.id, input.placeholder, input.getAttribute('aria-label')].filter(Boolean).join(' | ');
    console.log(dbgId);
  }
  console.groupEnd();

  for (const input of inputs) {
    const identifier = [
      input.name,
      input.id,
      input.placeholder,
      input.getAttribute('aria-label'),
      input.getAttribute('data-testid'),
      input.closest('label')?.textContent,
      document.querySelector(`label[for="${input.id}"]`)?.textContent,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    for (const { keys, value } of fieldMap) {
      if (!value) continue;
      if (keys.some(k => identifier.includes(k))) {
        setNativeValue(input, value);
        break;
      }
    }
  }
}

function collectFields() {
  aiFieldMap.clear();
  const result = [];
  const seenRadioGroups = new Set();
  let i = 0;

  const inputs = document.querySelectorAll(
    'input:not([type="hidden"]):not([type="file"]):not([type="submit"]):not([type="button"]):not([type="reset"]):not([type="image"]), textarea, select'
  );

  for (const el of inputs) {
    if (el.type === 'radio') {
      if (seenRadioGroups.has(el.name)) continue;
      seenRadioGroups.add(el.name);
      const groupRadios = Array.from(document.querySelectorAll(`input[type="radio"][name="${el.name}"]`));
      if (groupRadios.some(r => r.checked)) continue;
      const groupLabel = getGroupLabel(el) || el.name || `Question ${i}`;
      const key = `cvt_field_${i++}`;
      aiFieldMap.set(key, { type: 'radio-group', els: groupRadios });
      result.push({
        key,
        label: groupLabel.slice(0, 150),
        type: 'radio',
        required: el.required,
        options: groupRadios.map(r => ({
          value: r.value,
          label: (document.querySelector(`label[for="${r.id}"]`)?.textContent?.trim() || r.value).slice(0, 60),
        })),
      });
      continue;
    }

    if (el.type === 'checkbox') {
      if (el.checked) continue;
    } else {
      if (el.value?.trim()) continue;
    }

    const label = getFieldLabel(el);
    if (!label) continue;

    const key = `cvt_field_${i++}`;

    if (el.tagName === 'SELECT') {
      const options = Array.from(el.options)
        .filter(o => o.value)
        .map(o => ({ value: o.value.slice(0, 50), label: o.text.trim().slice(0, 60) }))
        .slice(0, 40);
      aiFieldMap.set(key, { type: 'native-select', el });
      result.push({ key, label: label.slice(0, 150), type: 'select', required: el.required, options });
      continue;
    }

    if (el.tagName === 'TEXTAREA') {
      aiFieldMap.set(key, { type: 'input', el });
      result.push({ key, label: label.slice(0, 150), type: 'textarea', required: el.required });
      continue;
    }

    if (el.type === 'checkbox') {
      aiFieldMap.set(key, { type: 'checkbox', el });
      result.push({ key, label: label.slice(0, 150), type: 'checkbox', required: el.required });
      continue;
    }

    // text/search inputs — check for custom dropdown options nearby
    const customOptions = findCustomDropdownOptions(el);
    if (customOptions.length > 0) {
      aiFieldMap.set(key, { type: 'custom-select', el, options: customOptions });
      result.push({ key, label: label.slice(0, 150), type: 'select', required: el.required, options: customOptions });
    } else {
      aiFieldMap.set(key, { type: 'input', el });
      result.push({ key, label: label.slice(0, 150), type: el.type || 'text', required: el.required });
    }
  }

  const final = result.slice(0, 40);
  console.group('[CV Tailor] collectFields debug');
  console.log(`${final.length} fields collected:`);
  final.forEach(f => console.log(`[${f.type}${f.required ? '*' : ''}] "${f.label}" → ${f.options ? `${f.options.length} options: ${JSON.stringify(f.options.slice(0, 3))}` : 'free text'}`));
  console.groupEnd();
  return final;
}

function findCustomDropdownOptions(inputEl) {
  // aria-controls/aria-owns points to listbox
  const controlsId = inputEl.getAttribute('aria-controls') || inputEl.getAttribute('aria-owns');
  if (controlsId) {
    const listbox = document.getElementById(controlsId);
    if (listbox) {
      const items = listbox.querySelectorAll('[role="option"], li');
      if (items.length) return extractOptions(items);
    }
  }

  // Walk up the DOM looking for option-like elements in parent containers
  let container = inputEl.parentElement;
  for (let depth = 0; depth < 6 && container; depth++, container = container.parentElement) {
    const roleOptions = container.querySelectorAll('[role="option"]');
    if (roleOptions.length > 0) return extractOptions(roleOptions);

    const listbox = container.querySelector('[role="listbox"]');
    if (listbox) {
      const items = listbox.querySelectorAll('li, [role="option"]');
      if (items.length) return extractOptions(items);
    }

    const dataValueEls = container.querySelectorAll('[data-value]:not(input):not(textarea)');
    if (dataValueEls.length > 1) return extractOptions(dataValueEls);

    const ul = container.querySelector('ul');
    if (ul && ul.querySelectorAll('li').length > 1) return extractOptions(ul.querySelectorAll('li'));
  }

  return [];
}

function extractOptions(elements) {
  return Array.from(elements)
    .map(el => ({
      value: (el.getAttribute('data-value') || el.getAttribute('data-id') || el.textContent.trim()).slice(0, 80),
      label: el.textContent.trim().slice(0, 80),
    }))
    .filter(o => o.label && o.value)
    .slice(0, 50);
}

async function applyAiFields(answers) {
  for (const [key, value] of Object.entries(answers)) {
    const entry = aiFieldMap.get(key);
    if (!entry || value === null || value === undefined || value === '') continue;

    if (entry.type === 'radio-group') {
      for (const radio of entry.els) {
        if (radio.value === String(value)) {
          radio.checked = true;
          radio.dispatchEvent(new Event('change', { bubbles: true }));
          break;
        }
      }
    } else if (entry.type === 'checkbox') {
      const shouldCheck = value === 'true' || value === true || value === 'yes' || value === 'Yes' || value === '1';
      if (entry.el.checked !== shouldCheck) {
        entry.el.checked = shouldCheck;
        entry.el.dispatchEvent(new Event('change', { bubbles: true }));
      }
    } else if (entry.type === 'native-select') {
      setNativeValue(entry.el, String(value));
    } else if (entry.type === 'custom-select') {
      await applyCustomSelect(entry.el, entry.options, String(value));
    } else {
      setNativeValue(entry.el, String(value));
    }
  }
}

async function applyCustomSelect(inputEl, options, value) {
  const match = options.find(o =>
    o.value === value ||
    o.label.toLowerCase() === value.toLowerCase() ||
    o.label.toLowerCase().includes(value.toLowerCase())
  );

  // Focus to open dropdown
  inputEl.focus();
  inputEl.click();
  inputEl.dispatchEvent(new Event('focus', { bubbles: true }));
  await new Promise(r => setTimeout(r, 350));

  if (match) {
    // Search all visible option-like elements in the page (dropdown is now open)
    const candidates = document.querySelectorAll('[role="option"], [data-value]:not(input), ul li');
    for (const el of candidates) {
      const elText = el.textContent.trim();
      const elVal = el.getAttribute('data-value') || el.getAttribute('data-id') || elText;
      if (elVal === match.value || elText.toLowerCase() === match.label.toLowerCase()) {
        el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
        el.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }));
        el.click();
        await new Promise(r => setTimeout(r, 150));
        return;
      }
    }
  }

  // Fallback: set text value directly
  setNativeValue(inputEl, match ? match.label : value);
}

function getFieldLabel(el) {
  return (
    document.querySelector(`label[for="${el.id}"]`)?.textContent?.trim() ||
    el.closest('label')?.textContent?.trim() ||
    el.getAttribute('aria-label') ||
    el.placeholder
  ) || '';
}

function getGroupLabel(radioEl) {
  const fieldset = radioEl.closest('fieldset');
  if (fieldset) {
    const legend = fieldset.querySelector('legend');
    if (legend) return legend.textContent.trim();
  }

  let node = radioEl.parentElement;
  for (let depth = 0; depth < 6 && node; depth++, node = node.parentElement) {
    const children = Array.from(node.childNodes);
    for (const child of children) {
      if (child === radioEl || child.contains?.(radioEl)) break;
      if (child.nodeType === Node.ELEMENT_NODE &&
          !['INPUT', 'SELECT', 'TEXTAREA', 'BUTTON', 'LABEL'].includes(child.tagName)) {
        const text = child.textContent?.trim();
        if (text && text.length > 3 && text.length < 200) return text;
      }
    }
  }

  return '';
}

function setNativeValue(el, value) {
  const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
    el.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype,
    'value'
  )?.set;

  if (nativeInputValueSetter) {
    nativeInputValueSetter.call(el, value);
  } else {
    el.value = value;
  }

  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
}
