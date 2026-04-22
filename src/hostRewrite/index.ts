/**
 * hostRewrite — managed-block writer for AMP host integration.
 *
 * Each installed AMP pack appends a managed block to the host agent's rules file
 * (CLAUDE.md, AGENTS.md, .windsurfrules, etc.). The block is delimited by:
 *
 *   <!-- amp:begin @creator/slug -->
 *   ... agents.md content inlined verbatim ...
 *   > Pack files: .amp/slug/memory/
 *   <!-- amp:end @creator/slug -->
 *
 * Operations are idempotent: appending when a block already exists updates it,
 * removing a block that doesn't exist is a no-op.
 */

import fs from "node:fs";
import path from "node:path";
import { ensureDir } from "../paths/index.js";

function beginMarker(creator: string, slug: string): string {
  return `<!-- amp:begin @${creator}/${slug} -->`;
}

function endMarker(creator: string, slug: string): string {
  return `<!-- amp:end @${creator}/${slug} -->`;
}

function buildBlock(creator: string, slug: string, agentsMdContent: string, packDir: string): string {
  const relPackDir = packDir.replace(/\\/g, "/");
  return [
    beginMarker(creator, slug),
    agentsMdContent.trimEnd(),
    "",
    `> Pack files: ${relPackDir}/memory/`,
    endMarker(creator, slug),
  ].join("\n");
}

export function hasManagedBlock(rulesFile: string, creator: string, slug: string): boolean {
  if (!fs.existsSync(rulesFile)) return false;
  const content = fs.readFileSync(rulesFile, "utf-8");
  return content.includes(beginMarker(creator, slug));
}

/**
 * Append a managed block to the rules file. If the block already exists,
 * it is replaced (idempotent update). Creates the rules file if it doesn't exist.
 */
export function writeManagedBlock(
  rulesFile: string,
  creator: string,
  slug: string,
  agentsMdContent: string,
  packDir: string
): void {
  ensureDir(path.dirname(rulesFile));

  const block = buildBlock(creator, slug, agentsMdContent, packDir);

  if (!fs.existsSync(rulesFile)) {
    fs.writeFileSync(rulesFile, block + "\n", "utf-8");
    return;
  }

  const existing = fs.readFileSync(rulesFile, "utf-8");
  const begin = beginMarker(creator, slug);
  const end = endMarker(creator, slug);

  if (existing.includes(begin)) {
    // Replace existing block
    const beginIdx = existing.indexOf(begin);
    const endIdx = existing.indexOf(end, beginIdx);
    if (endIdx === -1) {
      // Malformed — end marker missing. Append fresh block with warning.
      console.warn(`Warning: found opening amp block for @${creator}/${slug} but no closing marker. Appending new block.`);
      const updated = existing.trimEnd() + "\n\n" + block + "\n";
      fs.writeFileSync(rulesFile, updated, "utf-8");
      return;
    }
    // endIdx points to start of end marker — advance past it + trailing newline
    const afterEnd = endIdx + end.length;
    const tail = existing.slice(afterEnd).replace(/^\n/, ""); // consume one trailing newline
    const updated = existing.slice(0, beginIdx).trimEnd() + "\n\n" + block + (tail ? "\n\n" + tail : "\n");
    fs.writeFileSync(rulesFile, updated, "utf-8");
  } else {
    // Append new block
    const updated = existing.trimEnd() + "\n\n" + block + "\n";
    fs.writeFileSync(rulesFile, updated, "utf-8");
  }
}

/**
 * For Cursor: write the pack as its own rules file (no append needed).
 * The file IS the managed block — deleting the file is uninstall.
 */
export function writeCursorRulesFile(
  rulesFile: string,
  creator: string,
  slug: string,
  agentsMdContent: string,
  packDir: string
): void {
  ensureDir(path.dirname(rulesFile));
  const block = buildBlock(creator, slug, agentsMdContent, packDir);
  fs.writeFileSync(rulesFile, block + "\n", "utf-8");
}

/**
 * Remove the managed block for @creator/slug from the rules file.
 * If the block isn't found, this is a no-op.
 */
export function removeManagedBlock(rulesFile: string, creator: string, slug: string): void {
  if (!fs.existsSync(rulesFile)) return;

  const content = fs.readFileSync(rulesFile, "utf-8");
  const begin = beginMarker(creator, slug);
  const end = endMarker(creator, slug);

  const beginIdx = content.indexOf(begin);
  if (beginIdx === -1) return; // block not found — no-op

  const endIdx = content.indexOf(end, beginIdx);
  if (endIdx === -1) {
    console.warn(`Warning: amp block for @${creator}/${slug} has no closing marker — leaving file unchanged.`);
    return;
  }

  const afterEnd = endIdx + end.length;
  // Remove block: everything from just before the block (trimming the preceding \n\n) to after the end marker
  const before = content.slice(0, beginIdx).trimEnd();
  const after = content.slice(afterEnd).replace(/^\n/, ""); // consume one trailing newline

  const updated = before + (after.trim() ? "\n\n" + after.trimStart() : "\n");
  fs.writeFileSync(rulesFile, updated, "utf-8");
}
