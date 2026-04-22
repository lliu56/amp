import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import {
  resolvePackDir,
  resolveInstallDir,
  resolveHostRulesFile,
  ensureDir,
  writeMeta,
  type InstallScope,
} from "../paths/index.js";
import { writeManagedBlock, writeCursorRulesFile } from "../hostRewrite/index.js";
import { CliError } from "../errors/index.js";

interface InstallOptions {
  scope?: InstallScope;
  agent?: string;
  fromPath?: string;  // --from-path local directory (required in amp CLI)
}

// ---------------------------------------------------------------------------
// AMP pack validation
// ---------------------------------------------------------------------------

interface AmpManifest {
  name: string;
  layout: string;
  capability_files?: string[];
  [key: string]: unknown;
}

function validateAmpPack(dir: string): AmpManifest {
  const manifestPath = path.join(dir, "manifest.json");
  if (!fs.existsSync(manifestPath)) {
    throw new CliError("Missing manifest.json in pack directory", "INVALID_PACK");
  }

  let manifest: AmpManifest;
  try {
    manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8")) as AmpManifest;
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new CliError(`manifest.json is not valid JSON: ${msg}`, "INVALID_PACK");
  }

  if (manifest.layout !== "semantic-cluster") {
    throw new CliError(
      `Pack layout is '${manifest.layout}', expected 'semantic-cluster'. This pack is not AMP v0.2+ compatible.`,
      "INVALID_PACK"
    );
  }

  const agentsPath = path.join(dir, "agents.md");
  if (!fs.existsSync(agentsPath)) {
    throw new CliError("Missing agents.md — pack cannot be routed without a routing file", "INVALID_PACK");
  }

  const capFiles = manifest.capability_files ?? [];
  for (const capFile of capFiles) {
    const capPath = path.join(dir, "memory", capFile);
    if (!fs.existsSync(capPath)) {
      throw new CliError(`Missing capability file: memory/${capFile}`, "INVALID_PACK");
    }
  }

  return manifest;
}

// ---------------------------------------------------------------------------
// Subtree copy
// ---------------------------------------------------------------------------

function copyDir(src: string, dest: string): void {
  ensureDir(dest);
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

// ---------------------------------------------------------------------------
// Host managed block writer
// ---------------------------------------------------------------------------

function writeHostManagedBlock(
  agent: string,
  scope: InstallScope,
  cwd: string,
  slug: string,
  creator: string,
  packDir: string
): void {
  const agentsMdPath = path.join(packDir, "agents.md");
  if (!fs.existsSync(agentsMdPath)) return;

  const agentsMdContent = fs.readFileSync(agentsMdPath, "utf-8");
  const rulesFile = resolveHostRulesFile(agent, scope, cwd, slug);

  if (agent === "cursor") {
    writeCursorRulesFile(rulesFile, creator, slug, agentsMdContent, packDir);
  } else {
    writeManagedBlock(rulesFile, creator, slug, agentsMdContent, packDir);
  }

  console.log(`Host rules updated: ${rulesFile}`);
}

// ---------------------------------------------------------------------------
// Detect host agent from project files
// ---------------------------------------------------------------------------

function detectAgent(cwd: string): string | null {
  if (fs.existsSync(path.join(cwd, "CLAUDE.md"))) return "claude-code";
  if (fs.existsSync(path.join(cwd, "AGENTS.md"))) return "codex";
  if (fs.existsSync(path.join(cwd, ".cursor"))) return "cursor";
  if (fs.existsSync(path.join(cwd, ".cursorrules"))) return "cursor";
  if (fs.existsSync(path.join(cwd, ".windsurfrules"))) return "windsurf";
  return null;
}

// ---------------------------------------------------------------------------
// Install — local pack from --from-path only.
//
// The open-source amp CLI only supports local installs from a pack directory.
// There is no registry / auth layer — any registry implementation (including
// MemoryMarket, or your own) lives outside this CLI.
// ---------------------------------------------------------------------------

export async function install(options: InstallOptions = {}): Promise<void> {
  if (!options.fromPath) {
    throw new CliError(
      "Usage: amp install --from-path <pack-dir> [--scope project|user] [--agent claude-code|codex|cursor|windsurf]",
      "MISSING_FROM_PATH"
    );
  }

  const cwd = process.cwd();
  const scope: InstallScope = options.scope ?? "project";

  // Scope guard
  if (scope === "project") {
    const markers = ["package.json", "pyproject.toml", "Cargo.toml", "go.mod", ".git", "CLAUDE.md", "AGENTS.md"];
    const inProject = markers.some((m) => fs.existsSync(path.join(cwd, m)));
    if (!inProject) {
      throw new CliError(
        "Not inside a project directory. Use --scope user to install globally.",
        "NOT_IN_PROJECT"
      );
    }
  }

  const srcDir = path.resolve(cwd, options.fromPath);
  if (!fs.existsSync(srcDir) || !fs.statSync(srcDir).isDirectory()) {
    throw new CliError(`--from-path '${options.fromPath}' is not a valid directory`, "INVALID_PATH");
  }

  // Validate AMP pack structure
  const manifest = validateAmpPack(srcDir);

  if (!manifest.signed) {
    console.warn("Warning: pack is not signed. Only install packs you trust.");
  }

  // Derive slug from manifest
  const slug = manifest.name;
  if (!/^[a-z0-9][a-z0-9-]{0,63}$/.test(slug)) {
    throw new CliError(
      `Invalid slug "${slug}" in manifest.json. Must match ^[a-z0-9][a-z0-9-]{0,63}$.`,
      "INVALID_PACK"
    );
  }

  const creator = "local";
  const agent = options.agent ?? detectAgent(cwd) ?? "claude-code";
  const installDir = resolveInstallDir(scope, cwd);
  const packDir = resolvePackDir(slug, scope, cwd);

  ensureDir(installDir);

  // Copy pack subtree
  copyDir(srcDir, packDir);
  console.log(`Pack extracted to: ${packDir}`);

  // Write host managed block
  writeHostManagedBlock(agent, scope, cwd, slug, creator, packDir);

  // Write sidecar meta
  const manifestHash = crypto
    .createHash("sha256")
    .update(fs.readFileSync(path.join(packDir, "manifest.json")))
    .digest("hex");

  writeMeta(
    {
      slug,
      creator,
      version: 1,
      sha256: manifestHash,
      installedAt: new Date().toISOString(),
      installScope: scope,
      packDir,
      activationSnippet: "",
      agent,
    },
    scope,
    cwd
  );

  console.log(`\nInstalled ${slug} (${agent}, scope=${scope}).`);
}
