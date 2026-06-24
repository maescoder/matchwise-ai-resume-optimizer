import "dotenv/config";
import { spawn } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import mammoth from "mammoth";
import multer from "multer";
import pdfParse from "pdf-parse";
import { buildApplicationPrompt, applicationPackSchema } from "./prompts/applicationPrompt.mjs";
import { buildResumePrompt, resumeSchema } from "./prompts/resumePrompt.mjs";

const app = express();
const port = Number(process.env.PORT || 3000);
const maxTextLength = 45_000;
const __dirname = dirname(fileURLToPath(import.meta.url));
const atsScorerPath = join(__dirname, "scripts", "ats_score.py");
const allowedMimeTypes = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain"
]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (_request, file, callback) => {
    const extension = file.originalname.toLowerCase().split(".").pop();
    const validExtension = ["pdf", "docx", "txt"].includes(extension);
    callback(validExtension || allowedMimeTypes.has(file.mimetype) ? null : new Error("Upload a PDF, DOCX, or TXT resume."), validExtension || allowedMimeTypes.has(file.mimetype));
  }
});

app.use(express.json({ limit: "1mb" }));
app.use("/vendor/three", express.static(join(__dirname, "node_modules", "three", "build")));
app.use(express.static("public"));

app.get("/api/health", (_request, response) => {
  response.json({ ok: true, configured: Boolean(process.env.GEMINI_API_KEY) });
});

app.post("/api/extract-resume", upload.single("resume"), async (request, response, next) => {
  try {
    if (!request.file) {
      return response.status(400).json({ error: "Choose a PDF, DOCX, or TXT resume first." });
    }

    const text = await extractResumeText(request.file);
    if (!text.trim()) {
      return response.status(422).json({ error: "No readable text was found in this file. Try pasting the resume text instead." });
    }

    response.json({ text: text.trim().slice(0, maxTextLength), truncated: text.length > maxTextLength });
  } catch (error) {
    next(error);
  }
});

app.post("/api/rewrite", async (request, response, next) => {
  try {
    const jobDescription = cleanInput(request.body?.jobDescription);
    const currentResume = cleanInput(request.body?.currentResume);

    if (!jobDescription || !currentResume) {
      return response.status(400).json({ error: "Add both the job description and current resume before generating." });
    }
    if (jobDescription.length > maxTextLength || currentResume.length > maxTextLength) {
      return response.status(413).json({ error: "Each input must be 45,000 characters or fewer." });
    }
    if (!process.env.GEMINI_API_KEY) {
      return response.status(503).json({ error: "The server is missing GEMINI_API_KEY. Add it to your .env file and restart the app." });
    }

    const resume = await generateResume({ jobDescription, currentResume });
    validateResume(resume);
    response.json({ resume });
  } catch (error) {
    next(error);
  }
});

app.post("/api/score", async (request, response, next) => {
  try {
    const jobDescription = cleanInput(request.body?.jobDescription);
    const currentResume = cleanInput(request.body?.currentResume);

    if (!jobDescription || !currentResume) {
      return response.status(400).json({ error: "Add both the current resume and job description before scoring." });
    }
    if (jobDescription.length > maxTextLength || currentResume.length > maxTextLength) {
      return response.status(413).json({ error: "Each input must be 45,000 characters or fewer." });
    }

    const analysis = await scoreResumeWithPython({ jobDescription, currentResume });
    response.json({ analysis });
  } catch (error) {
    next(error);
  }
});

app.post("/api/application-pack", async (request, response, next) => {
  try {
    const jobDescription = cleanInput(request.body?.jobDescription);
    const currentResume = cleanInput(request.body?.currentResume);

    if (!jobDescription || !currentResume) {
      return response.status(400).json({ error: "Add both the current resume and job description before generating messages." });
    }
    if (jobDescription.length > maxTextLength || currentResume.length > maxTextLength) {
      return response.status(413).json({ error: "Each input must be 45,000 characters or fewer." });
    }
    if (!process.env.GEMINI_API_KEY) {
      return response.status(503).json({ error: "The server is missing GEMINI_API_KEY. Add it to your .env file and restart the app." });
    }

    const applicationPack = await generateApplicationPack({ jobDescription, currentResume });
    validateApplicationPack(applicationPack);
    response.json({ applicationPack });
  } catch (error) {
    next(error);
  }
});

app.use((error, _request, response, _next) => {
  if (error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE") {
    return response.status(413).json({ error: "The file is too large. Upload a resume smaller than 8 MB." });
  }
  if (error.message === "Upload a PDF, DOCX, or TXT resume.") {
    return response.status(415).json({ error: error.message });
  }

  console.error(error);
  response.status(error.status || 500).json({ error: error.expose ? error.message : "Could not generate the resume. Please try again." });
});

app.listen(port, () => {
  console.log(`AWS Resume Optimizer is running at http://localhost:${port}`);
});

async function extractResumeText(file) {
  const filename = file.originalname.toLowerCase();
  if (filename.endsWith(".txt") || file.mimetype === "text/plain") {
    return file.buffer.toString("utf8");
  }
  if (filename.endsWith(".docx")) {
    const result = await mammoth.extractRawText({ buffer: file.buffer });
    return result.value;
  }
  if (filename.endsWith(".pdf") || file.mimetype === "application/pdf") {
    const result = await pdfParse(file.buffer);
    return result.text;
  }
  throw Object.assign(new Error("Upload a PDF, DOCX, or TXT resume."), { status: 415, expose: true });
}

async function generateResume({ jobDescription, currentResume }) {
  return generateGeminiJson({
    prompt: buildResumePrompt({ jobDescription, currentResume }),
    schema: resumeSchema,
    emptyMessage: "Gemini returned an empty response. Please try again.",
    invalidMessage: "Gemini returned an invalid resume response. Please try again."
  });
}

async function generateApplicationPack({ jobDescription, currentResume }) {
  return generateGeminiJson({
    prompt: buildApplicationPrompt({ jobDescription, currentResume }),
    schema: applicationPackSchema,
    emptyMessage: "Gemini returned an empty application pack. Please try again.",
    invalidMessage: "Gemini returned invalid application messages. Please try again."
  });
}

async function generateGeminiJson({ prompt, schema, emptyMessage, invalidMessage }) {
  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(process.env.GEMINI_API_KEY)}`;
  const geminiResponse = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 8192,
        responseMimeType: "application/json",
        responseSchema: schema
      }
    })
  });

  const data = await geminiResponse.json().catch(() => ({}));
  if (!geminiResponse.ok) {
    const providerMessage = data?.error?.message || "Gemini did not complete the request.";
    throw Object.assign(new Error(providerMessage), { status: geminiResponse.status, expose: true });
  }

  const text = data?.candidates?.[0]?.content?.parts?.map((part) => part.text || "").join("").trim();
  if (!text) {
    throw Object.assign(new Error(emptyMessage), { status: 502, expose: true });
  }

  try {
    return JSON.parse(stripCodeFence(text));
  } catch {
    throw Object.assign(new Error(invalidMessage), { status: 502, expose: true });
  }
}

function scoreResumeWithPython({ jobDescription, currentResume }) {
  const pythonCommand = process.env.PYTHON_BIN || "python";
  const payload = JSON.stringify({ jobDescription, currentResume });

  return new Promise((resolve, reject) => {
    const child = spawn(pythonCommand, [atsScorerPath], {
      cwd: __dirname,
      stdio: ["pipe", "pipe", "pipe"],
      windowsHide: true
    });

    let stdout = "";
    let stderr = "";
    const timeout = setTimeout(() => {
      child.kill();
      reject(Object.assign(new Error("ATS scoring timed out. Please try a shorter resume or job description."), { status: 504, expose: true }));
    }, 12_000);

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString("utf8");
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString("utf8");
    });
    child.on("error", () => {
      clearTimeout(timeout);
      reject(Object.assign(new Error("Python is required for ATS scoring. Install Python or set PYTHON_BIN in .env."), { status: 503, expose: true }));
    });
    child.on("close", (code) => {
      clearTimeout(timeout);
      if (code !== 0) {
        return reject(Object.assign(new Error(stderr.trim() || "ATS scoring failed. Please try again."), { status: 502, expose: true }));
      }
      try {
        resolve(JSON.parse(stdout));
      } catch {
        reject(Object.assign(new Error("ATS scoring returned invalid output. Please try again."), { status: 502, expose: true }));
      }
    });

    child.stdin.end(payload);
  });
}

function cleanInput(value) {
  return typeof value === "string" ? value.trim() : "";
}

function stripCodeFence(value) {
  return value.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```$/, "").trim();
}

function validateResume(resume) {
  const requiredArrays = ["education", "workExperience", "skills", "projects", "achievements"];
  if (!resume || typeof resume !== "object" || !resume.contact || typeof resume.professionalSummary !== "string") {
    throw Object.assign(new Error("Gemini returned an incomplete resume. Please try again."), { status: 502, expose: true });
  }
  const summary = resume.professionalSummary.trim();
  if (!summary || /[\r\n]/.test(summary) || summary.split(/\s+/).length > 55) {
    throw Object.assign(new Error("Gemini did not follow the one-line summary requirement. Please try again."), { status: 502, expose: true });
  }
  if (requiredArrays.some((key) => !Array.isArray(resume[key]))) {
    throw Object.assign(new Error("Gemini returned an incomplete resume. Please try again."), { status: 502, expose: true });
  }
  if (resume.workExperience.some((job) => !Array.isArray(job.bullets) || job.bullets.length > 3)) {
    throw Object.assign(new Error("Gemini did not follow the three-bullet experience limit. Please try again."), { status: 502, expose: true });
  }
}

function validateApplicationPack(applicationPack) {
  const requiredFields = ["coverLetter", "recruiterEmail", "linkedInDM", "referralRequest"];
  if (!applicationPack || typeof applicationPack !== "object") {
    throw Object.assign(new Error("Gemini returned incomplete application messages. Please try again."), { status: 502, expose: true });
  }
  if (requiredFields.some((field) => typeof applicationPack[field] !== "string" || !applicationPack[field].trim())) {
    throw Object.assign(new Error("Gemini returned incomplete application messages. Please try again."), { status: 502, expose: true });
  }
}
