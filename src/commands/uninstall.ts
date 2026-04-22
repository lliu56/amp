import fs from "node:fs";
import {
  resolvePackDir,
  resolveMetaPath,
  resolveHostRulesFile,
  readMeta,
  type InstallScope,
} from "../paths/index.js";
import { removeManagedBlock } from "../hostRewrite/index.js";

interface UninstallOptions {
  scope?: InstallScope;
}

export async function uninstall(slug: string, options: UninstallOptions = {}): Promise<void> {
  // Strip @username/ prefix if present — uninstall accepts both forms.
  const cleanSlug = slug.startsWith("@") ? slug.split("/").slice(1).join("/") : slug;
  const cwd = process.cwd();
  const scope: InstallScope = options.scope ?? "project";

  const meta = readMeta(cleanSlug, scope, cwd);

  const packDir = resolvePackDir(cleanSlug, scope, cwd);
  const hasPackDir = fs.existsSync(packDir) && fs.statSync(packDir).isDirectory();

  if (!meta && !hasPackDir) {
    console.log("Not installed.");
    return;
  }

  // Remove managed block from host rules file
  const creator = meta?.creator ?? "local";
  const agent = meta?.agent ?? "claude-code";
  const rulesFile = resolveHostRulesFile(agent, scope, cwd, cleanSlug);

  if (agent === "cursor") {
    // Cursor: the rules file IS the managed block — delete it
    if (fs.existsSync(rulesFile)) {
      fs.unlinkSync(rulesFile);
      console.log(`Removed Cursor rules file: ${rulesFile}`);
    }
  } else {
    removeManagedBlock(rulesFile, creator, cleanSlug);
    console.log(`Host rules updated: ${rulesFile}`);
  }

  // Remove pack directory
  if (hasPackDir) {
    fs.rmSync(packDir, { recursive: true, force: true });
    console.log(`Removed pack directory: ${packDir}`);
  }

  // Remove sidecar meta
  const metaPath = resolveMetaPath(cleanSlug, scope, cwd);
  if (fs.existsSync(metaPath)) {
    fs.unlinkSync(metaPath);
  }

  console.log(`Uninstalled ${cleanSlug}.`);
}
