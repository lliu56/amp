import path from "node:path";
import os from "node:os";
import fs from "node:fs";

export type InstallScope = "project" | "user";

export function resolveInstallDir(scope: InstallScope, cwd: string): string {
  if (scope === "user") {
    return path.join(os.homedir(), ".amp");
  }
  return path.join(cwd, ".amp");
}

/** Returns the pack's directory (v0.2 AMP subtree). */
export function resolvePackDir(slug: string, scope: InstallScope, cwd: string): string {
  return path.join(resolveInstallDir(scope, cwd), slug);
}

/**
 * @deprecated v0.1 single-file path — used only for backward-compat uninstall
 * of old-style packs. New installs use resolvePackDir.
 */
export function resolvePackPath(slug: string, scope: InstallScope, cwd: string): string {
  return path.join(resolveInstallDir(scope, cwd), `${slug}.md`);
}

export function resolveMetaDir(scope: InstallScope, cwd: string): string {
  return path.join(resolveInstallDir(scope, cwd), ".meta");
}

export function resolveMetaPath(slug: string, scope: InstallScope, cwd: string): string {
  return path.join(resolveMetaDir(scope, cwd), `${slug}.json`);
}

export function resolveBackupDir(scope: InstallScope, cwd: string): string {
  return path.join(resolveInstallDir(scope, cwd), ".backups");
}

export function resolveBackupPath(slug: string, scope: InstallScope, cwd: string): string {
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  return path.join(resolveBackupDir(scope, cwd), `${slug}-${ts}.md`);
}

/**
 * Returns the host agent's rules file path for managed-block writes.
 * - claude-code → CLAUDE.md (project) or ~/.claude/CLAUDE.md (user)
 * - codex       → AGENTS.md (project) or ~/.agents.md (user)
 * - cursor      → .cursor/rules/amp-<slug>.md (one file per pack, no append needed)
 * - windsurf    → .windsurfrules (project) or ~/.windsurfrules (user)
 * - openclaw    → ~/.openclaw/workspace/AGENTS.md (always; workspace-based agent)
 * - default     → CLAUDE.md
 */
export function resolveHostRulesFile(
  agent: string,
  scope: InstallScope,
  cwd: string,
  slug?: string
): string {
  // OpenClaw is workspace-based — always resolves to home-dir workspace regardless of scope
  if (agent === "openclaw") {
    return path.join(os.homedir(), ".openclaw", "workspace", "AGENTS.md");
  }

  if (scope === "user") {
    switch (agent) {
      case "codex":
        return path.join(os.homedir(), ".agents.md");
      case "cursor":
        return path.join(os.homedir(), ".cursor", "rules", `amp-${slug ?? "pack"}.md`);
      case "windsurf":
        return path.join(os.homedir(), ".windsurfrules");
      default: // claude-code
        return path.join(os.homedir(), ".claude", "CLAUDE.md");
    }
  }
  switch (agent) {
    case "codex":
      return path.join(cwd, "AGENTS.md");
    case "cursor":
      return path.join(cwd, ".cursor", "rules", `amp-${slug ?? "pack"}.md`);
    case "windsurf":
      return path.join(cwd, ".windsurfrules");
    default: // claude-code
      return path.join(cwd, "CLAUDE.md");
  }
}

export function isInsideProject(cwd: string): boolean {
  const markers = [
    "package.json", "pyproject.toml", "Cargo.toml", "go.mod",
    ".git", "CLAUDE.md", "AGENTS.md",
  ];
  return markers.some((m) => fs.existsSync(path.join(cwd, m)));
}

export function ensureDir(dirPath: string): void {
  fs.mkdirSync(dirPath, { recursive: true });
}

export interface PackMeta {
  slug: string;
  creator: string;       // used to reconstruct block marker on uninstall
  version: number;
  sha256: string;
  installedAt: string;
  installScope: InstallScope;
  packDir: string;       // replaces packPath (v0.1) — now a directory
  agent: string;
  activationSnippet: string;
}

export function readMeta(slug: string, scope: InstallScope, cwd: string): PackMeta | null {
  const metaPath = resolveMetaPath(slug, scope, cwd);
  try {
    const raw = fs.readFileSync(metaPath, "utf-8");
    return JSON.parse(raw) as PackMeta;
  } catch {
    return null;
  }
}

export function writeMeta(meta: PackMeta, scope: InstallScope, cwd: string): void {
  const metaDir = resolveMetaDir(scope, cwd);
  ensureDir(metaDir);
  const metaPath = resolveMetaPath(meta.slug, scope, cwd);
  fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2), "utf-8");
}
