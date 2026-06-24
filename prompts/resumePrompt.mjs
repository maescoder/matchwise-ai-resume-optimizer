export const resumeSchema = {
  type: "OBJECT",
  properties: {
    contact: {
      type: "OBJECT",
      properties: {
        fullName: { type: "STRING" },
        address: { type: "STRING" },
        phone: { type: "STRING" },
        email: { type: "STRING" },
        linkedIn: { type: "STRING" },
        github: { type: "STRING" }
      },
      required: ["fullName", "address", "phone", "email", "linkedIn", "github"]
    },
    professionalSummary: { type: "STRING" },
    education: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          degree: { type: "STRING" },
          college: { type: "STRING" },
          location: { type: "STRING" },
          startDate: { type: "STRING" },
          endDate: { type: "STRING" }
        },
        required: ["degree", "college", "location", "startDate", "endDate"]
      }
    },
    workExperience: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          company: { type: "STRING" },
          location: { type: "STRING" },
          title: { type: "STRING" },
          startDate: { type: "STRING" },
          endDate: { type: "STRING" },
          bullets: { type: "ARRAY", items: { type: "STRING" } }
        },
        required: ["company", "location", "title", "startDate", "endDate", "bullets"]
      }
    },
    skills: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          category: { type: "STRING" },
          items: { type: "ARRAY", items: { type: "STRING" } }
        },
        required: ["category", "items"]
      }
    },
    projects: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          title: { type: "STRING" },
          bullets: { type: "ARRAY", items: { type: "STRING" } }
        },
        required: ["title", "bullets"]
      }
    },
    achievements: {
      type: "ARRAY",
      items: { type: "STRING" }
    }
  },
  required: [
    "contact",
    "professionalSummary",
    "education",
    "workExperience",
    "skills",
    "projects",
    "achievements"
  ]
};

export function buildResumePrompt({ jobDescription, currentResume }) {
  return `You are an expert resume writer and ATS optimization specialist. Generate a completely new, ATS-optimized resume from the Job Description and Current Resume below.

WORKING METHOD (perform silently):
1. Extract only factual raw data from the current resume: contact details, education, company names, job titles, dates, projects, achievements, certifications, responsibilities, tools, and quantified outcomes.
2. Identify primary and secondary ATS keywords, relevant tools, domain terms, methodologies, soft skills, action verbs, and impact language from the job description.
3. Reconstruct the resume in fresh language that is concise, achievement-oriented, readable, and targeted to the role.

FACTUALITY RULES (non-negotiable):
- Never invent or infer employers, job titles, dates, locations, education, projects, skills, certifications, responsibilities, metrics, links, awards, or results.
- Use job-description keywords only where they are supported by the current resume. Do not turn desired job requirements into claimed experience.
- Do not copy sentences from the current resume. Use fresh wording while retaining verified facts.
- Preserve every project from the current resume. Keep project descriptions factual and include relevant supported tools and keywords naturally.
- Preserve an existing LinkedIn or GitHub URL exactly. For any missing contact field, use "Not provided".
- Keep only factual achievements and relevant certifications in achievements. Return an empty achievements list if none exist.

CONTENT RULES (non-negotiable):
- Professional summary: exactly one concise line, role-aligned and impact-focused.
- Work experience: include every factual role, with at most three most-relevant bullets per role. Every bullet begins with a strong action verb and includes a measurable impact only when the source resume provides that metric.
- Skills: group into clear categories and place the most job-relevant supported skills first.
- Do not include commentary, notes, keyword lists, explanations, markdown, or any content outside the requested JSON structure.

Return valid JSON only, matching the supplied response schema exactly.

JOB DESCRIPTION:
---
${jobDescription}
---

CURRENT RESUME:
---
${currentResume}
---`;
}
