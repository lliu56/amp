import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { readMeta, resolvePackDir, type InstallScope } from "../paths/index.js";

interface InspectOptions {
  scope?: InstallScope;
}

export function inspect(slug: string, options: InspectOptions = {}): void {
  const cwd = process.cwd();
  const scope: InstallScope = options.scope ?? "project";
  const meta = readMeta(slug, scope, cwd);

  if (!meta) {
    console.log(`${slug} is not installed.`);
    process.exit(1);
  }

  // Detect local tampering: compare manifest.json sha256 vs stored meta.
  let tampered = false;
  try {
    const manifestPath = path.join(resolvePackDir(slug, scope, cwd), "manifest.json");
    const body = fs.readFileSync(manifestPath);
    const diskSha = crypto.createHash("sha256").update(body).digest("hex");
    tampered = diskSha !== meta.sha256;
    if (tampered) {
      console.error(
        `WARNING: ${slug}/manifest.json has been modified locally.\n` +
        `  stored sha256: ${meta.sha256}\n` +
        `  on-disk sha256: ${diskSha}`
      );
    }
  } catch {
    // Pack directory missing — surface it but don't block inspection of meta.
    console.error(`WARNING: pack directory for ${slug} is missing on disk.`);
  }

  console.log(JSON.stringify(meta, null, 2));
  if (tampered) process.exit(2);
}
