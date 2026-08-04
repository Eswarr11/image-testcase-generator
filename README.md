# Jira Test Case Generator

Generate comprehensive Jira-ready test cases from **Confluence documents** and **Figma designs** using OpenAI GPT-4o.

## Features

- Paste one or more Confluence and/or Figma links
- Fetch page text and Figma screenshots via a local Express proxy
- Generate structured Jira test cases with GPT-4o (server-side)
- Optional focus prompt and manual image uploads
- **Session vault:** secrets saved once to server memory (httpOnly cookie)
- Dark/light theme, CSV export, toast feedback

## Tech Stack

**Monorepo:** npm workspaces (`backend/` + `frontend/`) — Thrive-style separation  
**Backend:** TypeScript, Express (modules with controllers / services / dto)  
**Frontend:** React 18, TypeScript, Tailwind CSS, Vite (`features/` + `commons/`)

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

## Project structure

```
backend/     Express API — Thrive-like modules (session, sources, generate, health)
frontend/    React app — features/ + commons/ (like thrive-frontend)
```
