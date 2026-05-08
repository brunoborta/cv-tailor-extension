const PROFILE = 'profile';
const AI_CONFIG = 'aiConfig';
const PREVIEW = 'cv_tailor_preview';
const PRINT_HTML = { cv: 'cv_tailor_print_html', cl: 'cv_tailor_print_cl_html' };
const JOB_CACHE = 'cv_tailor_job_cache';
const JOB_CACHE_MAX = 20;

export const getProfile = () => chrome.storage.local.get(PROFILE).then(r => r[PROFILE]);
export const setProfile = profile => chrome.storage.local.set({ [PROFILE]: profile });
export const patchProfile = async patch => setProfile({ ...(await getProfile()), ...patch });

export const getAiConfig = () => chrome.storage.local.get(AI_CONFIG).then(r => r[AI_CONFIG]);
export const setAiConfig = aiConfig => chrome.storage.local.set({ [AI_CONFIG]: aiConfig });

export const getPreview = () => chrome.storage.local.get(PREVIEW).then(r => r[PREVIEW]);
export const setPreview = preview => chrome.storage.local.set({ [PREVIEW]: preview });
export const clearPreview = () => chrome.storage.local.remove(PREVIEW);

export const getPrintHtml = kind => chrome.storage.local.get(PRINT_HTML[kind]).then(r => r[PRINT_HTML[kind]]);
export const setPrintHtml = (kind, html) => chrome.storage.local.set({ [PRINT_HTML[kind]]: html });
export const clearPrintHtml = kind => chrome.storage.local.remove(PRINT_HTML[kind]);

export async function getJobCache(hash) {
  const r = await chrome.storage.local.get(JOB_CACHE);
  return r[JOB_CACHE]?.[hash]?.data;
}

export async function setJobCache(hash, data) {
  const r = await chrome.storage.local.get(JOB_CACHE);
  const cache = r[JOB_CACHE] || {};
  cache[hash] = { data, ts: Date.now() };

  const entries = Object.entries(cache);
  if (entries.length > JOB_CACHE_MAX) {
    entries.sort((a, b) => b[1].ts - a[1].ts);
    return chrome.storage.local.set({ [JOB_CACHE]: Object.fromEntries(entries.slice(0, JOB_CACHE_MAX)) });
  }
  return chrome.storage.local.set({ [JOB_CACHE]: cache });
}
