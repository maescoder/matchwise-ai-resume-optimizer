import json
import math
import re
import sys
from collections import Counter


STOPWORDS = {
    "a", "an", "and", "are", "as", "at", "be", "by", "for", "from", "has",
    "have", "in", "into", "is", "it", "of", "on", "or", "our", "that", "the",
    "their", "this", "to", "using", "with", "within", "you", "your", "we", "will",
    "work", "role", "team", "teams", "candidate", "responsibilities", "required",
    "requirements", "preferred", "qualification", "qualifications", "experience",
    "need", "needs", "skill", "skills", "intern", "internship", "problem",
    "solving",
}

TECH_TERMS = [
    "aws", "amazon web services", "ec2", "s3", "lambda", "iam", "vpc", "cloudwatch",
    "cloudformation", "terraform", "docker", "kubernetes", "eks", "ecs", "rds",
    "dynamodb", "api gateway", "route 53", "sns", "sqs", "redshift", "glue",
    "athena", "linux", "python", "java", "javascript", "typescript", "node.js",
    "express", "react", "sql", "postgresql", "mysql", "mongodb", "git", "github",
    "ci/cd", "jenkins", "github actions", "devops", "rest api", "microservices",
    "machine learning", "ml", "nlp", "data analysis", "pandas", "numpy",
    "scikit-learn", "tensorflow", "pytorch", "power bi", "tableau", "spark",
    "hadoop", "etl", "agile", "scrum", "jira", "unit testing", "automation",
    "security", "serverless", "cloud", "saas", "api", "html", "css",
]

SOFT_SKILLS = [
    "communication", "collaboration", "leadership", "problem solving",
    "analytical", "stakeholder", "documentation", "ownership", "adaptability",
    "mentoring", "cross-functional", "customer", "presentation",
]

ACTION_VERBS = [
    "built", "created", "developed", "designed", "implemented", "deployed",
    "automated", "optimized", "improved", "reduced", "increased", "managed",
    "led", "delivered", "analyzed", "integrated", "configured", "monitored",
    "tested", "launched", "migrated", "secured",
]


def normalize(text):
    return re.sub(r"\s+", " ", text.lower()).strip()


def tokenize(text):
    raw_tokens = re.findall(r"[a-zA-Z][a-zA-Z0-9+#./-]*", text.lower())
    return [token.strip(".,;:!?()[]{}") for token in raw_tokens if token.strip(".,;:!?()[]{}")]


def contains_phrase(text, phrase):
    pattern = r"(?<![a-z0-9])" + re.escape(phrase.lower()) + r"(?![a-z0-9])"
    return bool(re.search(pattern, text))


def extract_job_keywords(job_text):
    normalized = normalize(job_text)
    tokens = [token for token in tokenize(job_text) if len(token) > 2 and token not in STOPWORDS]
    counts = Counter(tokens)

    keyword_scores = {}
    for term in TECH_TERMS + SOFT_SKILLS:
        if contains_phrase(normalized, term):
            keyword_scores[term] = keyword_scores.get(term, 0) + 4

    for token, count in counts.items():
        if token not in STOPWORDS and not token.isdigit():
            keyword_scores[token] = keyword_scores.get(token, 0) + min(count, 4)

    ranked = sorted(keyword_scores.items(), key=lambda item: (-item[1], item[0]))
    return ranked[:45]


def weighted_coverage(job_keywords, resume_text):
    if not job_keywords:
        return 0, [], []

    normalized_resume = normalize(resume_text)
    total_weight = sum(weight for _, weight in job_keywords)
    matched = []
    missing = []
    matched_weight = 0

    for keyword, weight in job_keywords:
        if contains_phrase(normalized_resume, keyword):
            matched.append(keyword)
            matched_weight += weight
        else:
            missing.append(keyword)

    score = round((matched_weight / total_weight) * 100) if total_weight else 0
    return score, matched[:30], missing[:25]


def skill_score(job_text, resume_text, skill_list):
    job_normalized = normalize(job_text)
    resume_normalized = normalize(resume_text)
    required = [skill for skill in skill_list if contains_phrase(job_normalized, skill)]
    if not required:
        return 75, [], []
    matched = [skill for skill in required if contains_phrase(resume_normalized, skill)]
    missing = [skill for skill in required if skill not in matched]
    return round((len(matched) / len(required)) * 100), matched, missing


def section_completeness(resume_text):
    normalized = normalize(resume_text)
    email_found = bool(re.search(r"[\w.+-]+@[\w.-]+\.[a-zA-Z]{2,}", resume_text))
    phone_found = bool(re.search(r"(\+?\d[\d\s().-]{7,}\d)", resume_text))
    sections = {
        "contact": email_found or phone_found,
        "education": bool(re.search(r"\b(education|degree|university|college|bachelor|master)\b", normalized)),
        "experience": bool(re.search(r"\b(experience|employment|intern|developer|engineer|analyst)\b", normalized)),
        "skills": bool(re.search(r"\b(skills|technologies|tools|programming)\b", normalized)),
        "projects": bool(re.search(r"\b(project|projects|portfolio)\b", normalized)),
        "certifications": bool(re.search(r"\b(certification|certifications|certificate|aws certified)\b", normalized)),
    }
    score = round(sum(sections.values()) / len(sections) * 100)
    return score, sections


def impact_score(resume_text):
    lines = [line.strip().lower() for line in resume_text.splitlines() if line.strip()]
    if not lines:
        return 0, 0, 0

    metric_lines = sum(bool(re.search(r"(\d+%|\$[\d,.]+|\b\d+[xkKmM+]?\b)", line)) for line in lines)
    action_lines = sum(any(line.startswith(verb) or f" {verb} " in line for verb in ACTION_VERBS) for line in lines)
    score = min(100, round(((metric_lines * 1.3) + action_lines) / max(6, len(lines) * 0.42) * 100))
    return score, metric_lines, action_lines


def length_quality(resume_text):
    word_count = len(tokenize(resume_text))
    if 380 <= word_count <= 900:
        return 100, word_count
    if 250 <= word_count < 380 or 900 < word_count <= 1100:
        return 78, word_count
    if 150 <= word_count < 250 or 1100 < word_count <= 1400:
        return 58, word_count
    return 35, word_count


def verdict(score):
    if score >= 85:
        return "Excellent match"
    if score >= 72:
        return "Strong match"
    if score >= 58:
        return "Moderate match"
    if score >= 42:
        return "Weak match"
    return "Needs major targeting"


def build_recommendations(missing_keywords, missing_skills, sections, impact):
    recommendations = []
    if missing_skills:
        recommendations.append("Add truthful evidence for high-priority skills: " + ", ".join(missing_skills[:6]) + ".")
    if missing_keywords:
        recommendations.append("Naturally include missing job keywords where your resume already has matching experience: " + ", ".join(missing_keywords[:8]) + ".")
    if impact < 65:
        recommendations.append("Rewrite bullets with action verbs and measurable outcomes such as scale, speed, cost, accuracy, users, or percentage improvement.")
    missing_sections = [name for name, present in sections.items() if not present]
    if missing_sections:
        recommendations.append("Improve ATS structure by adding clear section labels for: " + ", ".join(missing_sections) + ".")
    if not recommendations:
        recommendations.append("The resume is well aligned; review wording for accuracy and keep tailoring examples to the exact role.")
    return recommendations[:5]


def build_heatmap(job_keywords, resume_text):
    weighted_keywords = [(keyword, weight) for keyword, weight in job_keywords if len(keyword) > 2]
    lines = [line.strip() for line in resume_text.splitlines() if line.strip()]
    heatmap = []

    for line in lines[:80]:
        normalized_line = normalize(line)
        matched = []
        score = 0
        for keyword, weight in weighted_keywords:
            if contains_phrase(normalized_line, keyword):
                matched.append(keyword)
                score += weight

        has_metric = bool(re.search(r"(\d+%|\$[\d,.]+|\b\d+[xkKmM+]?\b)", line))
        has_action = any(normalized_line.startswith(verb) or f" {verb} " in normalized_line for verb in ACTION_VERBS)
        looks_like_heading = len(tokenize(line)) <= 4 and not matched

        if matched and score >= 8:
            level = "strong"
            label = "Strong match"
            reason = "Matches high-priority JD terms: " + ", ".join(matched[:5])
        elif matched:
            level = "partial"
            label = "Partial match"
            reason = "Some JD overlap: " + ", ".join(matched[:5])
        elif has_metric or has_action:
            level = "weak"
            label = "Weak / improve"
            reason = "Useful achievement signal, but it needs clearer JD keywords."
        elif looks_like_heading:
            level = "neutral"
            label = "Section label"
            reason = "Structural line; not scored heavily for keywords."
        else:
            level = "neutral"
            label = "Low relevance"
            reason = "No direct JD keyword match detected."

        heatmap.append({
            "text": line[:240],
            "level": level,
            "label": label,
            "reason": reason,
            "matchedKeywords": matched[:8],
        })

    return heatmap


def analyze(job_description, current_resume):
    keywords = extract_job_keywords(job_description)
    keyword_score, matched_keywords, missing_keywords = weighted_coverage(keywords, current_resume)
    hard_score, matched_hard, missing_hard = skill_score(job_description, current_resume, TECH_TERMS)
    soft_score, matched_soft, missing_soft = skill_score(job_description, current_resume, SOFT_SKILLS)
    section_score, sections = section_completeness(current_resume)
    impact, metric_lines, action_lines = impact_score(current_resume)
    length_score, word_count = length_quality(current_resume)

    total = round(
        keyword_score * 0.35
        + hard_score * 0.25
        + soft_score * 0.10
        + section_score * 0.15
        + impact * 0.10
        + length_score * 0.05
    )

    strengths = []
    if matched_hard:
        strengths.append("Hard-skill overlap: " + ", ".join(matched_hard[:8]) + ".")
    if matched_keywords:
        strengths.append("JD keyword coverage includes: " + ", ".join(matched_keywords[:8]) + ".")
    if impact >= 70:
        strengths.append("Resume already contains measurable/action-oriented achievement signals.")
    if section_score >= 80:
        strengths.append("Core ATS sections are present and easy to detect.")
    if not strengths:
        strengths.append("The resume has enough source text to begin targeted optimization.")

    return {
        "score": max(0, min(100, total)),
        "verdict": verdict(total),
        "summary": f"{verdict(total)} with {keyword_score}% weighted keyword coverage and {hard_score}% hard-skill overlap.",
        "breakdown": {
            "keywordCoverage": keyword_score,
            "hardSkillMatch": hard_score,
            "softSkillMatch": soft_score,
            "sectionCompleteness": section_score,
            "measurableImpact": impact,
            "lengthQuality": length_score,
        },
        "matchedKeywords": matched_keywords,
        "missingKeywords": missing_keywords,
        "matchedSkills": matched_hard,
        "missingSkills": missing_hard,
        "matchedSoftSkills": matched_soft,
        "missingSoftSkills": missing_soft,
        "sectionSignals": sections,
        "stats": {
            "resumeWordCount": word_count,
            "metricLines": metric_lines,
            "actionVerbLines": action_lines,
            "jobKeywordsAnalyzed": len(keywords),
        },
        "heatmap": build_heatmap(keywords, current_resume),
        "strengths": strengths[:5],
        "recommendations": build_recommendations(missing_keywords, missing_hard, sections, impact),
    }


def main():
    try:
        payload = json.loads(sys.stdin.read() or "{}")
        job_description = str(payload.get("jobDescription", "")).strip()
        current_resume = str(payload.get("currentResume", "")).strip()
        if not job_description or not current_resume:
            raise ValueError("Both jobDescription and currentResume are required.")
        print(json.dumps(analyze(job_description, current_resume), ensure_ascii=True))
    except Exception as exc:
        print(str(exc), file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
