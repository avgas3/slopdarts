import fs from "node:fs";
import path from "node:path";

/**
 * Loads `.env` from the project root, if it exists. Existing environment
 * variables always win, so the file is a default rather than an override.
 * Deliberately minimal — `KEY=value` and `#` comments, no dependency.
 */
export function loadEnv(file = path.resolve(".env")) {
  let contents: string;
  try {
    contents = fs.readFileSync(file, "utf8");
  } catch {
    return;
  }

  for (const line of contents.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const separator = trimmed.indexOf("=");
    if (separator < 1) continue;

    const key = trimmed.slice(0, separator).trim();
    const value = trimmed.slice(separator + 1).trim().replace(/^["']|["']$/g, "");
    if (!(key in process.env)) process.env[key] = value;
  }
}
