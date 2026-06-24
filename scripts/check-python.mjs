import "dotenv/config";
import { spawnSync } from "node:child_process";

const pythonCommand = process.env.PYTHON_BIN || "python";
const result = spawnSync(pythonCommand, ["-m", "py_compile", "scripts/ats_score.py"], {
  stdio: "inherit",
  windowsHide: true
});

if (result.error) {
  console.error(`Could not run Python at "${pythonCommand}". Set PYTHON_BIN in .env.`);
  console.error(result.error.message);
  process.exit(1);
}

process.exit(result.status ?? 1);
