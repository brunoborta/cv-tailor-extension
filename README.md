# CV Tailor

A Chrome/Brave extension that reads a job posting, generates a tailored CV using AI, fills application forms automatically, and writes a matching cover letter.

## Features

- **Two generation modes**
  - *ATS Optimize* — rewrites your real CV with keywords from the job posting to pass ATS filters
  - *From Scratch* — builds a creative CV that bridges your background to a completely different field
- **Smart form filling** — fills known fields (name, email, phone, location) instantly, then asks AI to answer the remaining fields (visa questions, EU residency, custom dropdowns, etc.)
- **Cover letter** — generated alongside the CV, with a matching tone and job-specific content
- **CV preview** — renders the tailored CV in a clean, print-ready layout
- **Persistent results** — generated CV is saved locally so you can close and reopen the popup without regenerating
- **Multiple AI providers** — DeepSeek (free), Groq (free), Claude, OpenAI, or any OpenAI-compatible endpoint

## Installation

1. Clone or download this repository
2. Open Chrome/Brave and go to `chrome://extensions`
3. Enable **Developer mode** (top right)
4. Click **Load unpacked** and select this folder

## Setup

1. Click the extension icon → **Settings**
2. Upload your CV (PDF or paste text)
3. Fill in your personal info (name, email, phone, location)
4. Add your AI provider API key — [DeepSeek](https://platform.deepseek.com) and [Groq](https://console.groq.com) are free

## Usage

1. Navigate to any job posting
2. Click the extension icon
3. Choose a generation mode and click **Generate Tailored CV**
4. Use **Fill Form** to auto-fill the application form
5. Use **Preview CV** to open the formatted CV
6. Use **Cover Letter** to open the cover letter

## Stack

- Chrome Extension Manifest V3 — Vanilla JS, no build step
- [pdf.js](https://mozilla.github.io/pdf.js/) for PDF text extraction
- All data stored locally via `chrome.storage.local` — no backend, no tracking

## AI Providers

| Provider | Cost | Notes |
|---|---|---|
| DeepSeek | Free tier available | Default, good quality |
| Groq | Free tier available | Fast |
| Claude | Paid | Anthropic |
| OpenAI | Paid | GPT models |
| Custom | — | Any OpenAI-compatible API |
