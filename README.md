# Jira Test Case Generator

Generate comprehensive Jira-ready test cases from **Confluence documents** and **Figma designs** using OpenAI GPT-4o.

## Features

- Paste one or more Confluence and/or Figma links
- Fetch page text and Figma screenshots via a local Express proxy
- Generate structured Jira test cases with GPT-4o (server-side)
- Optional focus prompt and manual image uploads
- **Session vault:** secrets saved once to server memory (httpOnly cookie); Preview/Generate requests do not include API tokens
- Dark/light theme, CSV export, toast feedback

## Tech Stack

**Backend:** TypeScript, Express, Helmet, CORS, cookie-parser  
**Frontend:** React 18, TypeScript, Tailwind CSS, Vite

## Prerequisites

- Node.js 18+
- OpenAI API key
- Atlassian account (site URL + email + [API token](https://id.atlassian.com/manage-profile/security/api-tokens)) for Confluence
- Figma [Personal Access Token](https://www.figma.com/developers/api#access-tokens)

## Installation

```bash
git clone https://github.com/Eswarr11/image-testcase-generator.git
cd image-testcase-generator
npm install
npm run build
```

## Running

### Development
```bash
npm run dev
```
- Backend: `http://localhost:3000`
- Frontend: `http://localhost:5173`

### Production
```bash
npm run build
npm start
```
Open `http://localhost:3000`

## Credentials (session vault)

1. Open the **Credentials** panel
2. Save OpenAI, Atlassian, and/or Figma secrets (validated, then stored **in server memory**)
3. Browser receives an httpOnly `tcg_session` cookie — later API calls send only URLs/prompts

**Notes**
- Secrets appear in DevTools only on the Save request (`POST /api/session/credentials`)
- Preview / Generate / source fetches do **not** include tokens in body or headers
- Restarting the Node process clears the vault — Save credentials again
- localStorage may keep non-secret prefs (Atlassian site URL + email) only

## Usage

1. Save credentials once
2. Paste Confluence and/or Figma links (Add link for multiple)
3. Optionally Preview, add a focus prompt, or upload screenshots
4. Generate → server fetches sources and calls OpenAI
5. Copy or export as CSV

### Supported URL formats

**Confluence:** `.../wiki/spaces/{SPACE}/pages/{pageId}/...` or `?pageId=`  
**Figma:** `https://www.figma.com/design/{fileKey}/...?node-id=1-2`

## Security

- Tokens are not stored in browser localStorage
- Routine API calls are URL/prompt-only; upstream auth is applied on the server
- OpenAI is called from the server (not from the browser)

## License

MIT — see [LICENSE](LICENSE)

## Author

**Eswar A** — [@Eswarr11](https://github.com/Eswarr11)
