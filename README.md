# Matchwise — AI-Powered ATS Resume Optimizer and Career Copilot

A focused internship project that scores and rewrites a resume against a job description using a Python NLP scoring engine plus Google Gemini. It accepts pasted resume text or PDF, DOCX, and TXT uploads, then returns ATS analytics, a factual ATS-oriented resume, application outreach drafts, and downloadable Markdown/LaTeX versions.

## What it does

- Extracts text from PDF, DOCX, and TXT resumes without persisting the uploaded file.
- Calculates an ATS match score with a local Python NLP engine.
- Shows keyword coverage, hard-skill match, soft-skill match, section completeness, measurable-impact quality, missing keywords, and recommendations.
- Displays a resume heatmap that highlights strong, partial, weak, and low-relevance lines against the target job description.
- Generates a complete outreach pack: cover letter, short recruiter email, LinkedIn DM, and referral request message.
- Uses **one server-side Gemini API key**. There is no browser-exposed key, OpenRouter configuration, or multi-provider fallback.
- Keeps output factual: job-description keywords are used only when evidence appears in the uploaded resume.
- Enforces a one-line summary, up to three bullets for each role, all source projects, and a dedicated achievements/certifications section.
- Creates escaped, dependency-free LaTeX that can be compiled by `pdflatex`.
- Includes a responsive, light interface with locally served Three.js motion effects.

## Run locally

1. Install Node.js 20 or later.
2. Install Python 3.10 or later. If your Python executable is not named `python`, set `PYTHON_BIN` in `.env`.
3. Install packages:

   ```bash
   npm install
   ```

4. Copy `.env.example` to `.env` and set `GEMINI_API_KEY` to your Google Gemini API key.
5. Start the app:

   ```bash
   npm run dev
   ```

6. Visit `http://localhost:3000`.

## Configuration

| Variable | Required | Purpose |
| --- | --- | --- |
| `GEMINI_API_KEY` | Yes | Google Gemini API key, read only by the server. |
| `GEMINI_MODEL` | No | Defaults to `gemini-2.5-flash`. |
| `PORT` | No | Defaults to `3000`. |
| `PYTHON_BIN` | No | Python executable used by the ATS scoring endpoint. Defaults to `python`. |

## AI/ML project features

- **NLP keyword extraction:** extracts job-description terms, tools, skills, and role phrases.
- **Weighted match scoring:** compares resume coverage against JD keywords and separates hard skills from soft skills.
- **Feature engineering:** builds measurable features such as section completeness, action verbs, metrics, and resume length quality.
- **Recommendation engine:** turns low-scoring features into practical improvement suggestions.
- **Resume heatmap:** visualizes which resume lines strongly match, partially match, or need better job-description targeting.
- **Generative AI rewrite:** uses Gemini only after the user provides factual resume content and the target job description.
- **Application message generation:** creates job-specific outreach drafts while staying grounded in the original resume.

## AWS deployment path

The app is stateless and listens on `PORT`, so it can be deployed to AWS App Runner, Elastic Beanstalk, or ECS/Fargate. Add `GEMINI_API_KEY` in the service's environment-variable or secrets configuration; do not commit it to the repository.

## LaTeX export

Use **Download .tex** after generation. The app escapes LaTeX special characters (`#`, `$`, `%`, `&`, `~`, `_`, `^`, `\\`, `{`, `}`), uses only standard LaTeX packages, and does not define custom commands. Compile it with:

```bash
pdflatex resume.tex
```
