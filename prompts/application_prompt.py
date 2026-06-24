from typing import Any


APPLICATION_PACK_SCHEMA: dict[str, Any] = {
    "type": "OBJECT",
    "properties": {
        "coverLetter": {"type": "STRING"},
        "recruiterEmail": {"type": "STRING"},
        "linkedInDM": {"type": "STRING"},
        "referralRequest": {"type": "STRING"},
    },
    "required": ["coverLetter", "recruiterEmail", "linkedInDM", "referralRequest"],
}


def build_application_prompt(job_description: str, current_resume: str) -> str:
    return f"""
You are an expert career coach and professional job-application writer.

Create an application outreach pack from these inputs:

Job Description:
{job_description}

Current Resume:
{current_resume}

Return JSON only, following the provided schema.

Rules:
- Use only factual skills, education, projects, and experience supported by the current resume.
- Align the messages to the job description naturally.
- Do not invent certifications, employers, dates, metrics, education, or tools.
- Keep the tone confident, concise, human, and professional.
- If a company name, recruiter name, or role title is not clearly available, use neutral wording instead of placeholders.
- Do not include markdown headings.

Output requirements:
- coverLetter: 220-320 words, 3-4 short paragraphs, targeted to the role.
- recruiterEmail: subject line plus a short email body under 140 words.
- linkedInDM: under 600 characters, conversational and polite.
- referralRequest: under 900 characters, warm and respectful, asking for a referral without pressure.
""".strip()
