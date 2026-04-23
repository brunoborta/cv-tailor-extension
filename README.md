# CV Tailor

A Chrome/Brave extension that reads a job posting, generates a tailored CV and cover letter using AI, and renders them in a clean, print-ready layout.

No backend. No tracking. Everything runs locally and through your own API key.

---

## Installation

1. Clone or download this repository
2. Open Chrome/Brave → `chrome://extensions`
3. Enable **Developer mode** (top right)
4. Click **Load unpacked** and select this folder

---

## Setup

Open the extension → **Settings** and fill in:

- **Personal info** — name, email, phone, location, LinkedIn
- **Your CV** — upload a PDF or paste plain text. Optional, but required for ATS Optimize mode.
- **Languages** — list the languages you speak (e.g. `English (C2), Portuguese (Native)`). If left blank, the AI will try to detect them from your CV.
- **AI provider** — choose a provider and paste your API key. [DeepSeek](https://platform.deepseek.com) and [Groq](https://console.groq.com) both have free tiers.

---

## How it works

1. **Navigate to a job posting** — any page with a job description (LinkedIn, Greenhouse, Lever, company careers pages, etc.)
2. **Open the extension** — it reads the full page text and sends it to the AI to extract: company, job title, description, requirements, nice-to-haves, and company values
3. **Choose a generation mode** and click **Generate Tailored CV**
4. The AI writes a tailored CV and cover letter, which you can preview, edit, and save as PDF

---

## Generation modes

### ATS Optimize

> Requires your CV uploaded in Settings.

The AI acts as an **editor**, not a writer. It takes your existing CV and rewrites it to better match the job posting — same experience, same skills, same achievements — but rephrased with the exact keywords the job uses, so it passes ATS (Applicant Tracking System) filters.

What it does:
- Rewrites your summary using job-relevant keywords
- Matches your skill names to the terminology in the posting (e.g. "React" → "React.js" if that's what the job says)
- Rewrites experience bullets to highlight what's relevant — same facts, better framing
- Keeps every job from your CV, in the same order

What it never does:
- Add a skill you don't have
- Invent an achievement or responsibility
- Change the facts of your experience

Use this when you're applying for a role in your own field and want your CV to rank higher in automated screening.

---

### From Scratch

The AI's behavior depends on whether you have a CV uploaded:

**With a CV from a different area** — the AI acts as a **career transition specialist**. It reads your real background and finds what genuinely transfers to the new role. Your experience is reframed in terms of what it has in common with the target job, not fabricated.

What it does:
- Bridges your actual skills to the job's requirements
- Reframes past roles to highlight transferable responsibilities
- Writes a cover letter that honestly addresses the career change

What it never does:
- Add skills or technologies not present in your CV
- Invent professional experience or credentials

**Without a CV** — the AI builds a CV using only universal skills (communication, teamwork, problem-solving, adaptability) and common-sense practical skills for that specific job type. No professional history is invented. The experience section will be empty.

Use From Scratch when you're making a career change or applying to a field outside your CV's main area.

---

## CV Preview

Click **Preview CV** to open the formatted CV in a new tab.

- **Edit** — click Edit to make inline changes directly on the page before printing
- **Save as PDF** — opens the print dialog. Set the destination to **Save as PDF**. The suggested filename will be `CV - Company - Role.pdf`.

The same flow is available for the cover letter via **Cover Letter**.

---

## AI Providers

| Provider | Cost | Default model |
|---|---|---|
| DeepSeek | Free tier available | `deepseek-chat` |
| Groq | Free tier available | `llama-3.3-70b-versatile` |
| Claude | Paid | `claude-haiku-4-5` |
| OpenAI | Paid | `gpt-4o-mini` |
| Custom | — | Any OpenAI-compatible endpoint |

You can override the model name in Settings for any provider.

---

## Privacy

- All data (your CV, personal info, generated results) is stored locally via `chrome.storage.local`
- The only external requests are the AI API calls you configure
- No analytics, no backend, no accounts

---

## Stack

- Chrome Extension Manifest V3 — Vanilla JS, no build step
- [pdf.js](https://mozilla.github.io/pdf.js/) for PDF text extraction
