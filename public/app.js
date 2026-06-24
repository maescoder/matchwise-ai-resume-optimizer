const form = document.querySelector("#resumeForm");
const resumeInput = document.querySelector("#currentResume");
const jobInput = document.querySelector("#jobDescription");
const fileInput = document.querySelector("#resumeFile");
const uploadZone = document.querySelector("#uploadZone");
const fileName = document.querySelector("#fileName");
const scoreButton = document.querySelector("#scoreButton");
const applicationButton = document.querySelector("#applicationButton");
const generateButton = document.querySelector("#generateButton");
const formMessage = document.querySelector("#formMessage");
const output = document.querySelector("#resumeOutput");
const emptyState = document.querySelector("#emptyState");
const scorePanel = document.querySelector("#scorePanel");
const applicationPanel = document.querySelector("#applicationPanel");
const copyButton = document.querySelector("#copyButton");
const markdownButton = document.querySelector("#markdownButton");
const latexButton = document.querySelector("#latexButton");
const apiStatus = document.querySelector("#apiStatus");
const resumeCount = document.querySelector("#resumeCount");
const jobCount = document.querySelector("#jobCount");

let generatedResume = null;
let renderedMarkdown = "";

void checkService();
updateCounts();
initInteractiveExperience();

resumeInput.addEventListener("input", updateCounts);
jobInput.addEventListener("input", updateCounts);
fileInput.addEventListener("change", () => {
  const [file] = fileInput.files;
  if (file) void extractFile(file);
});

["dragenter", "dragover"].forEach((eventName) => uploadZone.addEventListener(eventName, (event) => {
  event.preventDefault();
  uploadZone.classList.add("is-dragging");
}));
["dragleave", "drop"].forEach((eventName) => uploadZone.addEventListener(eventName, (event) => {
  event.preventDefault();
  uploadZone.classList.remove("is-dragging");
}));
uploadZone.addEventListener("drop", (event) => {
  const [file] = event.dataTransfer.files;
  if (file) void extractFile(file);
});

scoreButton.addEventListener("click", async () => {
  const currentResume = resumeInput.value.trim();
  const jobDescription = jobInput.value.trim();
  if (!currentResume || !jobDescription) {
    showMessage("Add both the current resume and job description before scoring.", true);
    return;
  }

  setScoring(true);
  showMessage("Running Python NLP analysis for ATS keyword and skill match...");
  try {
    const response = await fetch("/api/score", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentResume, jobDescription })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Could not calculate the ATS score.");

    renderScore(data.analysis);
    scorePanel.hidden = false;
    emptyState.hidden = true;
    showMessage("ATS score calculated. Use the missing keywords and recommendations before generating.");
  } catch (error) {
    showMessage(error.message || "Could not calculate the ATS score.", true);
  } finally {
    setScoring(false);
  }
});

applicationButton.addEventListener("click", async () => {
  const currentResume = resumeInput.value.trim();
  const jobDescription = jobInput.value.trim();
  if (!currentResume || !jobDescription) {
    showMessage("Add both the current resume and job description before generating outreach messages.", true);
    return;
  }

  setApplicationGenerating(true);
  showMessage("Generating cover letter, recruiter email, LinkedIn DM, and referral request...");
  try {
    const response = await fetch("/api/application-pack", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentResume, jobDescription })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Could not generate the outreach pack.");

    renderApplicationPack(data.applicationPack);
    applicationPanel.hidden = false;
    emptyState.hidden = true;
    showMessage("Outreach pack generated. Personalize names/company details before sending.");
  } catch (error) {
    showMessage(error.message || "Could not generate the outreach pack.", true);
  } finally {
    setApplicationGenerating(false);
  }
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const currentResume = resumeInput.value.trim();
  const jobDescription = jobInput.value.trim();
  if (!currentResume || !jobDescription) {
    showMessage("Add both the current resume and job description.", true);
    return;
  }

  setGenerating(true);
  showMessage("Matching factual experience to the role and composing the new resume…");
  try {
    const response = await fetch("/api/rewrite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentResume, jobDescription })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Could not generate the resume.");

    generatedResume = data.resume;
    renderedMarkdown = formatResume(data.resume);
    output.textContent = renderedMarkdown;
    output.hidden = false;
    emptyState.hidden = true;
    [copyButton, markdownButton, latexButton].forEach((button) => { button.disabled = false; });
    showMessage("Resume generated. Review it carefully before applying.");
  } catch (error) {
    showMessage(error.message || "Could not generate the resume.", true);
  } finally {
    setGenerating(false);
  }
});

copyButton.addEventListener("click", async () => {
  if (!renderedMarkdown) return;
  try {
    await navigator.clipboard.writeText(renderedMarkdown);
    copyButton.textContent = "Copied";
    window.setTimeout(() => { copyButton.textContent = "Copy"; }, 1600);
  } catch {
    showMessage("Could not access the clipboard. Select and copy the result manually.", true);
  }
});

markdownButton.addEventListener("click", () => downloadFile("ats-resume.md", renderedMarkdown, "text/markdown;charset=utf-8"));
latexButton.addEventListener("click", () => {
  if (generatedResume) downloadFile("ats-resume.tex", buildLatex(generatedResume), "application/x-tex;charset=utf-8");
});

async function checkService() {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch("/api/health", { cache: "no-store", signal: controller.signal });
    if (!response.ok) throw new Error("Health check failed");
    const data = await response.json();
    if (data.configured) {
      apiStatus.textContent = "Gemini connected";
      apiStatus.className = "api-status is-ready";
    } else {
      apiStatus.textContent = "Add GEMINI_API_KEY";
      apiStatus.className = "api-status is-warning";
    }
  } catch {
    apiStatus.textContent = "Service unavailable";
    apiStatus.className = "api-status is-warning";
  } finally {
    window.clearTimeout(timeout);
  }
}

async function extractFile(file) {
  if (file.size > 8 * 1024 * 1024) {
    showMessage("The file is too large. Upload a resume smaller than 8 MB.", true);
    return;
  }
  fileName.textContent = file.name;
  showMessage(`Reading ${file.name}…`);
  const payload = new FormData();
  payload.append("resume", file);
  try {
    const response = await fetch("/api/extract-resume", { method: "POST", body: payload });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Could not read this file.");
    resumeInput.value = data.text;
    updateCounts();
    showMessage(data.truncated ? "Resume text was read and shortened to the allowed length." : "Resume text extracted. Add the job description when ready.");
  } catch (error) {
    showMessage(error.message || "Could not read this file.", true);
  }
}

function updateCounts() {
  resumeCount.textContent = `${resumeInput.value.length.toLocaleString()} characters`;
  jobCount.textContent = `${jobInput.value.length.toLocaleString()} characters`;
}

function setGenerating(isGenerating) {
  generateButton.disabled = isGenerating;
  generateButton.querySelector("span").textContent = isGenerating ? "Generating…" : "Generate ATS resume";
}

function setScoring(isScoring) {
  scoreButton.disabled = isScoring;
  scoreButton.querySelector("span").textContent = isScoring ? "Scoring..." : "Calculate ATS score";
}

function setApplicationGenerating(isGenerating) {
  applicationButton.disabled = isGenerating;
  applicationButton.querySelector("span").textContent = isGenerating ? "Writing..." : "Generate outreach pack";
}

function showMessage(message, isError = false) {
  formMessage.textContent = message;
  formMessage.classList.toggle("error", isError);
}

function renderScore(analysis) {
  scorePanel.replaceChildren();

  const header = document.createElement("div");
  header.className = "score-header";
  const meter = document.createElement("div");
  meter.className = "score-meter";
  meter.textContent = String(analysis.score ?? 0);
  const scoreValue = Math.max(0, Math.min(100, Number(analysis.score) || 0));
  meter.style.background = `conic-gradient(var(--deep-green) 0 ${scoreValue}%, #d8e3da ${scoreValue}% 100%)`;
  const titleWrap = document.createElement("div");
  const title = document.createElement("h3");
  title.textContent = `ATS Match: ${analysis.verdict || "Analysis ready"}`;
  const summary = document.createElement("p");
  summary.textContent = analysis.summary || "Score generated from resume and job description overlap.";
  titleWrap.append(title, summary);
  header.append(meter, titleWrap);

  const breakdown = document.createElement("div");
  breakdown.className = "breakdown-grid";
  for (const [label, value] of Object.entries(labelBreakdown(analysis.breakdown || {}))) {
    const item = document.createElement("div");
    const strong = document.createElement("strong");
    strong.textContent = `${value}%`;
    const span = document.createElement("span");
    span.textContent = label;
    item.append(strong, span);
    breakdown.append(item);
  }

  const lists = document.createElement("div");
  lists.className = "score-lists";
  lists.append(
    listBlock("Matched keywords", analysis.matchedKeywords),
    listBlock("Missing keywords", analysis.missingKeywords),
    listBlock("Strengths", analysis.strengths),
    listBlock("Recommendations", analysis.recommendations)
  );

  const stats = document.createElement("p");
  stats.className = "score-stats";
  const scoreStats = analysis.stats || {};
  stats.textContent = `Resume words: ${scoreStats.resumeWordCount ?? 0} | Metric lines: ${scoreStats.metricLines ?? 0} | Action-verb lines: ${scoreStats.actionVerbLines ?? 0} | JD keywords analyzed: ${scoreStats.jobKeywordsAnalyzed ?? 0}`;

  const heatmap = renderHeatmap(analysis.heatmap || []);

  scorePanel.append(header, breakdown, lists, heatmap, stats);
}

function labelBreakdown(breakdown) {
  return {
    "Keyword coverage": breakdown.keywordCoverage ?? 0,
    "Hard skills": breakdown.hardSkillMatch ?? 0,
    "Soft skills": breakdown.softSkillMatch ?? 0,
    "ATS sections": breakdown.sectionCompleteness ?? 0,
    "Measurable impact": breakdown.measurableImpact ?? 0,
    "Length quality": breakdown.lengthQuality ?? 0
  };
}

function listBlock(title, items = []) {
  const section = document.createElement("section");
  const heading = document.createElement("h4");
  heading.textContent = title;
  const list = document.createElement("ul");
  const visibleItems = items.length ? items.slice(0, 10) : ["None detected"];
  for (const item of visibleItems) {
    const li = document.createElement("li");
    li.textContent = item;
    list.append(li);
  }
  section.append(heading, list);
  return section;
}

function renderHeatmap(items) {
  const wrapper = document.createElement("section");
  wrapper.className = "heatmap";
  const heading = document.createElement("div");
  heading.className = "heatmap-heading";
  const title = document.createElement("h4");
  title.textContent = "Resume heatmap";
  const legend = document.createElement("p");
  legend.textContent = "Green = strong JD match, yellow = partial, red = needs stronger targeting, gray = low relevance/structure.";
  heading.append(title, legend);
  wrapper.append(heading);

  const list = document.createElement("div");
  list.className = "heatmap-list";
  const visibleItems = items.length ? items.slice(0, 40) : [{ text: "No resume lines available.", level: "neutral", label: "No data", reason: "Paste a resume to generate a heatmap." }];
  for (const item of visibleItems) {
    const row = document.createElement("article");
    row.className = `heatmap-row heatmap-${safeHeatmapLevel(item.level)}`;
    const badge = document.createElement("span");
    badge.textContent = item.label || "Line";
    const text = document.createElement("p");
    text.textContent = item.text || "";
    const reason = document.createElement("small");
    reason.textContent = item.reason || "";
    row.append(badge, text, reason);
    list.append(row);
  }
  wrapper.append(list);
  return wrapper;
}

function safeHeatmapLevel(level) {
  return ["strong", "partial", "weak", "neutral"].includes(level) ? level : "neutral";
}

function renderApplicationPack(pack) {
  applicationPanel.replaceChildren();

  const heading = document.createElement("div");
  heading.className = "application-heading";
  const title = document.createElement("h3");
  title.textContent = "Application outreach pack";
  const subtitle = document.createElement("p");
  subtitle.textContent = "Use these as drafts. Add the recruiter name, company name, and exact role before sending.";
  heading.append(title, subtitle);

  const grid = document.createElement("div");
  grid.className = "application-grid";
  grid.append(
    applicationCard("Cover letter", pack.coverLetter),
    applicationCard("Short recruiter email", pack.recruiterEmail),
    applicationCard("LinkedIn DM", pack.linkedInDM),
    applicationCard("Referral request", pack.referralRequest)
  );

  applicationPanel.append(heading, grid);
}

function applicationCard(title, content = "") {
  const card = document.createElement("article");
  const row = document.createElement("div");
  const heading = document.createElement("h4");
  heading.textContent = title;
  const copy = document.createElement("button");
  copy.type = "button";
  copy.className = "tiny-copy";
  copy.textContent = "Copy";
  copy.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(content);
      copy.textContent = "Copied";
      window.setTimeout(() => { copy.textContent = "Copy"; }, 1400);
    } catch {
      showMessage("Could not access the clipboard. Select and copy the message manually.", true);
    }
  });
  row.append(heading, copy);
  const body = document.createElement("p");
  body.textContent = content || "No content generated.";
  card.append(row, body);
  return card;
}

function formatResume(resume) {
  const contact = resume.contact || {};
  const lines = [
    `**${valueOrFallback(contact.fullName)}**`,
    "",
    `**Address:** ${valueOrFallback(contact.address)}`,
    "",
    `**Phone No:** ${valueOrFallback(contact.phone)} | **Email:** ${valueOrFallback(contact.email)} | **LinkedIn:** ${valueOrFallback(contact.linkedIn)} | **GitHub:** ${valueOrFallback(contact.github)}`,
    "",
    "---",
    "",
    "### **Professional Summary**",
    resume.professionalSummary.trim(),
    "",
    "---",
    "",
    "### **Education**"
  ];

  for (const item of resume.education || []) {
    lines.push(`**${valueOrFallback(item.degree)}**`, `${valueOrFallback(item.college)} | ${valueOrFallback(item.location)} | ${valueOrFallback(item.startDate)} - ${valueOrFallback(item.endDate)}`, "");
  }

  lines.push("---", "", "### **Work Experience**");
  for (const job of resume.workExperience || []) {
    lines.push(`**${valueOrFallback(job.company)} | ${valueOrFallback(job.location)} | ${valueOrFallback(job.title)}** | ${valueOrFallback(job.startDate)} - ${valueOrFallback(job.endDate)}`);
    for (const bullet of (job.bullets || []).slice(0, 3)) lines.push(`* ${bullet}`);
    lines.push("");
  }

  lines.push("---", "", "### **Skills**");
  for (const group of resume.skills || []) lines.push(`* **${valueOrFallback(group.category)}:** ${(group.items || []).join(", ")}`);

  lines.push("", "---", "", "### **Projects**");
  for (const project of resume.projects || []) {
    lines.push(`**${valueOrFallback(project.title)}**`);
    for (const bullet of project.bullets || []) lines.push(`* ${bullet}`);
    lines.push("");
  }

  if ((resume.achievements || []).length) {
    lines.push("---", "", "### **Achievements & Certifications**");
    for (const achievement of resume.achievements) lines.push(`* ${achievement}`);
    lines.push("");
  }

  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

function buildLatex(resume) {
  const contact = resume.contact || {};
  const line = (value) => escapeLatex(valueOrFallback(value));
  const parts = [
    String.raw`\documentclass[10pt]{article}`,
    String.raw`\usepackage[margin=0.65in]{geometry}`,
    String.raw`\usepackage[T1]{fontenc}`,
    String.raw`\usepackage[utf8]{inputenc}`,
    String.raw`\pagestyle{empty}`,
    String.raw`\setlength{\parindent}{0pt}`,
    String.raw`\setlength{\parskip}{4pt}`,
    String.raw`\sloppy`,
    String.raw`\begin{document}`,
    String.raw`\begin{center}`,
    String.raw`{\LARGE \textbf{${line(contact.fullName)}}}\\[4pt]`,
    String.raw`\small ${line(contact.address)}\\`,
    String.raw`\small Phone No: ${line(contact.phone)} \quad | \quad Email: ${line(contact.email)}\\`,
    String.raw`\small LinkedIn: ${line(contact.linkedIn)} \quad | \quad GitHub: ${line(contact.github)}`,
    String.raw`\end{center}`,
    String.raw`\section*{Professional Summary}`,
    line(resume.professionalSummary)
  ];

  appendEducation(parts, resume.education || [], line);
  appendExperience(parts, resume.workExperience || [], line);
  appendSkills(parts, resume.skills || [], line);
  appendProjects(parts, resume.projects || [], line);
  appendAchievements(parts, resume.achievements || [], line);
  parts.push(String.raw`\end{document}`);
  return parts.join("\n");
}

function appendEducation(parts, education, line) {
  parts.push(String.raw`\section*{Education}`);
  for (const item of education) {
    parts.push(String.raw`\textbf{${line(item.degree)}}\par`);
    parts.push(String.raw`${line(item.college)} \quad | \quad ${line(item.location)} \quad | \quad ${line(item.startDate)} -- ${line(item.endDate)}\par`);
  }
}

function appendExperience(parts, experience, line) {
  parts.push(String.raw`\section*{Work Experience}`);
  for (const job of experience) {
    parts.push(String.raw`\textbf{${line(job.company)} | ${line(job.location)} | ${line(job.title)}} \hfill ${line(job.startDate)} -- ${line(job.endDate)}`);
    parts.push(String.raw`\begin{itemize}`);
    for (const bullet of (job.bullets || []).slice(0, 3)) parts.push(String.raw`\item ${line(bullet)}`);
    parts.push(String.raw`\end{itemize}`);
  }
}

function appendSkills(parts, skills, line) {
  parts.push(String.raw`\section*{Skills}`);
  for (const group of skills) {
    const items = (group.items || []).map(line).join(String.raw`, \; `);
    parts.push(String.raw`\textbf{${line(group.category)}:} ${items}\par`);
  }
}

function appendProjects(parts, projects, line) {
  parts.push(String.raw`\section*{Projects}`);
  for (const project of projects) {
    parts.push(String.raw`\textbf{${line(project.title)}}`);
    parts.push(String.raw`\begin{itemize}`);
    for (const bullet of project.bullets || []) parts.push(String.raw`\item ${line(bullet)}`);
    parts.push(String.raw`\end{itemize}`);
  }
}

function appendAchievements(parts, achievements, line) {
  if (!achievements.length) return;
  parts.push(String.raw`\section*{Achievements \& Certifications}`);
  parts.push(String.raw`\begin{itemize}`);
  for (const achievement of achievements) parts.push(String.raw`\item ${line(achievement)}`);
  parts.push(String.raw`\end{itemize}`);
}

function escapeLatex(value) {
  const replacements = {
    "\\": String.raw`\textbackslash{}`,
    "{": String.raw`\{`,
    "}": String.raw`\}`,
    "#": String.raw`\#`,
    "$": String.raw`\$`,
    "%": String.raw`\%`,
    "&": String.raw`\&`,
    "_": String.raw`\_`,
    "~": String.raw`\textasciitilde{}`,
    "^": String.raw`\textasciicircum{}`
  };
  return toAscii(value).replace(/[\\{}#$%&_~^]/g, (character) => replacements[character]);
}

function toAscii(value) {
  return String(value || "")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, "\"")
    .replace(/[\u2013\u2014]/g, "--")
    .replace(/\u2026/g, "...")
    .replace(/\u20B9/g, "INR ")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x20-\x7E\n]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function valueOrFallback(value) {
  return typeof value === "string" && value.trim() ? value.trim() : "Not provided";
}

function downloadFile(filename, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function initInteractiveExperience() {
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  initScrollMotion(reduceMotion);
  if (reduceMotion) return;
  initPointerGlow();
  initTiltCards();
  initMagneticControls();
  void initThreeBackground();
}

function initScrollMotion(reduceMotion) {
  const revealItems = document.querySelectorAll(".reveal-on-scroll");
  const hasAnchorTarget = Boolean(window.location.hash);
  if (reduceMotion || !("IntersectionObserver" in window) || hasAnchorTarget) {
    revealItems.forEach((item) => item.classList.add("is-visible"));
  } else {
    document.documentElement.classList.add("motion-ready");
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      });
    }, { threshold: 0.08, rootMargin: "0px 0px -7%" });
    revealItems.forEach((item) => observer.observe(item));
  }

  const progress = document.querySelector("#scrollProgress");
  const methodSection = document.querySelector("#how-it-works");
  const methodMeter = document.querySelector("#methodMeter");
  let ticking = false;

  const update = () => {
    const scrollable = document.documentElement.scrollHeight - window.innerHeight;
    const pageProgress = scrollable > 0 ? (window.scrollY / scrollable) * 100 : 0;
    if (progress) progress.style.width = `${pageProgress}%`;

    if (methodSection && methodMeter) {
      const rect = methodSection.getBoundingClientRect();
      const distance = rect.height + window.innerHeight;
      const sectionProgress = Math.max(0, Math.min(1, (window.innerHeight - rect.top) / distance));
      methodMeter.style.width = `${Math.max(8, sectionProgress * 100)}%`;
    }
    ticking = false;
  };

  window.addEventListener("scroll", () => {
    if (!ticking) {
      window.requestAnimationFrame(update);
      ticking = true;
    }
  }, { passive: true });
  update();
}

function initPointerGlow() {
  const glow = document.querySelector(".cursor-glow");
  if (!glow) return;
  window.addEventListener("pointermove", (event) => {
    glow.style.transform = `translate3d(${event.clientX - 210}px, ${event.clientY - 210}px, 0)`;
  }, { passive: true });
  document.addEventListener("mouseleave", () => { glow.style.opacity = "0"; });
  document.addEventListener("mouseenter", () => { glow.style.opacity = ".55"; });
}

function initTiltCards() {
  document.querySelectorAll(".tilt-card").forEach((card) => {
    card.addEventListener("pointermove", (event) => {
      if (event.pointerType === "touch") return;
      const rect = card.getBoundingClientRect();
      const x = (event.clientX - rect.left) / rect.width - 0.5;
      const y = (event.clientY - rect.top) / rect.height - 0.5;
      const isHeroCard = card.classList.contains("match-card-main");
      const prefix = isHeroCard ? "translate(-50%, -50%) rotate(3deg) " : "";
      card.style.transform = `${prefix}perspective(1000px) rotateX(${-y * 2.5}deg) rotateY(${x * 3.5}deg) translateZ(0)`;
    });
    card.addEventListener("pointerleave", () => {
      card.style.transform = card.classList.contains("match-card-main") ? "translate(-50%, -50%) rotate(3deg)" : "";
    });
  });
}

function initMagneticControls() {
  document.querySelectorAll(".magnetic").forEach((control) => {
    control.addEventListener("pointermove", (event) => {
      if (event.pointerType === "touch") return;
      const rect = control.getBoundingClientRect();
      const x = (event.clientX - rect.left - rect.width / 2) * 0.08;
      const y = (event.clientY - rect.top - rect.height / 2) * 0.12;
      control.style.transform = `translate(${x}px, ${y}px)`;
    });
    control.addEventListener("pointerleave", () => { control.style.transform = ""; });
  });
}

async function initThreeBackground() {
  const canvas = document.querySelector("#ambientCanvas");
  if (!canvas) return;

  let THREE;
  try {
    THREE = await import("/vendor/three/three.module.min.js?v=20260624-3");
  } catch {
    canvas.hidden = true;
    return;
  }

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(52, window.innerWidth / window.innerHeight, 0.1, 100);
  camera.position.z = 12;
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.6));
  renderer.setSize(window.innerWidth, window.innerHeight, false);

  const group = new THREE.Group();
  scene.add(group);

  const orbGeometry = new THREE.IcosahedronGeometry(2.2, 2);
  const orbMaterial = new THREE.MeshBasicMaterial({ color: 0x78b998, wireframe: true, transparent: true, opacity: 0.095 });
  const orb = new THREE.Mesh(orbGeometry, orbMaterial);
  orb.position.set(4.8, 2.15, -2);
  group.add(orb);

  const ringGeometry = new THREE.TorusGeometry(2.5, 0.035, 8, 100);
  const ringMaterial = new THREE.MeshBasicMaterial({ color: 0xf29a82, transparent: true, opacity: 0.28 });
  const ring = new THREE.Mesh(ringGeometry, ringMaterial);
  ring.position.set(-5.3, -2.9, -3);
  ring.rotation.x = 1.05;
  ring.rotation.y = 0.35;
  group.add(ring);

  const particleCount = window.innerWidth < 700 ? 90 : 180;
  const positions = new Float32Array(particleCount * 3);
  for (let index = 0; index < particleCount; index += 1) {
    positions[index * 3] = (Math.random() - 0.5) * 21;
    positions[index * 3 + 1] = (Math.random() - 0.5) * 14;
    positions[index * 3 + 2] = (Math.random() - 0.5) * 8 - 2;
  }
  const particlesGeometry = new THREE.BufferGeometry();
  particlesGeometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const particlesMaterial = new THREE.PointsMaterial({ color: 0x4d936f, size: 0.035, transparent: true, opacity: 0.32 });
  const particles = new THREE.Points(particlesGeometry, particlesMaterial);
  group.add(particles);

  const pointer = { x: 0, y: 0 };
  window.addEventListener("pointermove", (event) => {
    pointer.x = (event.clientX / window.innerWidth - 0.5) * 2;
    pointer.y = (event.clientY / window.innerHeight - 0.5) * 2;
  }, { passive: true });

  const resize = () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight, false);
  };
  window.addEventListener("resize", resize, { passive: true });

  const clock = new THREE.Clock();
  const render = () => {
    const elapsed = clock.getElapsedTime();
    const scrollRatio = window.scrollY / Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    orb.rotation.x = elapsed * 0.055 + pointer.y * 0.08;
    orb.rotation.y = elapsed * 0.08 + pointer.x * 0.12;
    ring.rotation.z = elapsed * 0.06;
    particles.rotation.y = elapsed * 0.008 + scrollRatio * 0.22;
    group.position.x += (pointer.x * 0.12 - group.position.x) * 0.025;
    group.position.y += (-pointer.y * 0.08 + scrollRatio * 0.45 - group.position.y) * 0.02;
    renderer.render(scene, camera);
    window.requestAnimationFrame(render);
  };
  render();
}
