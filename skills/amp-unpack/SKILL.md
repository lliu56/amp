---
name: amp-unpack
description: After `amp install` or `mm install`, integrate an installed AMP pack into the user's Karpathy-style knowledge wiki. Detects existing wiki, scaffolds one if missing, merges the pack's memory into wiki pages with wikilinks and source attribution.
triggers:
  - /amp-unpack
args:
  - name: pack-slug
    required: false
    description: Specific pack slug to integrate. Default is all installed packs found in .amp/ and .memorymarket/.
  - name: --wiki-root
    required: false
    description: Path to the Karpathy wiki root. Default is knowledge-base/wiki/ relative to the current working directory.
  - name: --no-scaffold
    required: false
    description: If no wiki is found, fail instead of offering to scaffold one.
---

# /amp-unpack

Integrate installed AMP packs into a Karpathy-style knowledge wiki. Symmetric reverse of `/amp-capture` (wiki → pack). This skill runs **after** `amp install` or `mm install` has already dropped the pack into `.amp/<slug>/` or `.memorymarket/<slug>/`.

The skill is optional. The CLI install alone is enough to make the pack active via the managed block in `CLAUDE.md` / `AGENTS.md` / `.cursor/rules/`. This skill adds structured wiki integration on top.

## Usage

```
/amp-unpack [pack-slug] [--wiki-root path/to/wiki] [--no-scaffold]
```

If no pack-slug is given, integrate all packs found in `.amp/` and `.memorymarket/` subdirs (both project-scope cwd and user-scope home).

---

## Phase 1 — Discover installed packs

Scan these locations, in order, for installed AMP pack directories:

1. `<cwd>/.amp/*/manifest.json` (project scope, amp CLI)
2. `<cwd>/.memorymarket/*/manifest.json` (project scope, mm CLI)
3. `~/.amp/*/manifest.json` (user scope, amp CLI)
4. `~/.memorymarket/*/manifest.json` (user scope, mm CLI)

For each pack found, read:
- `manifest.json` — confirm `layout: "semantic-cluster"`, capture `name`, `capability_files`, `signed`, `sources`, and any creator identity field. Also capture `primitive_format` — one of `"inline-tag-v0.4"` or `"yaml-frontmatter-v0.3"`. If absent, default to `"yaml-frontmatter-v0.3"`. This field determines which parser to use in Phase 4.
- `agents.md` — the routing file, already inlined into the host agent's rules.
- `memory/<capability>.md` — one file per capability.

Also check `<cwd>/.amp/.meta/<slug>.json` and `<cwd>/.memorymarket/.meta/<slug>.json` for install metadata (`creator`, `installedAt`, `agent`).

If `pack-slug` is provided, filter to just that slug. If no packs are found, print a message pointing to `amp install --help` and stop.

Output: numbered list of discovered packs with slug, scope, capability count, signed status, source (.amp vs .memorymarket), and install date.

---

## Phase 2 — Detect wiki state

Use `--wiki-root` if provided. Otherwise default to `<cwd>/knowledge-base/wiki/`.

Classify the environment into exactly one of three states:

**State A — wiki exists**
Path exists and contains `index.md` AND `pages/` directory. No scaffolding needed. Skip to Phase 3.

**State B — knowledge-base exists but no wiki subtree**
`<cwd>/knowledge-base/` exists but no `wiki/` subdir (or `wiki/` exists but lacks `index.md` or `pages/`). Plan scaffolding for just the `wiki/` subtree inside the existing knowledge-base.

**State C — nothing**
No `knowledge-base/` directory at all. Plan full scaffold: `knowledge-base/SCHEMA.md`, `knowledge-base/wiki/index.md`, `knowledge-base/wiki/log.md`, `knowledge-base/wiki/pages/`.

In states B and C, if the user passed `--no-scaffold`, stop with an error pointing to the Karpathy wiki convention (https://github.com/karpathy/llm-wiki or equivalent). Otherwise, continue to Phase 3 and include the scaffold steps in the plan.

---

## Phase 3 — Plan and confirm

Print a concrete plan of every file that will be created or modified. Do not touch anything yet. Structure the plan as:

**Scaffold (if state B or C):**
- List exact file paths that will be created and a one-line description each
- Include `SCHEMA.md` stub if state C
- Include empty `index.md` with a starter section layout
- Include empty `log.md`

**Per pack:**
For each pack in the discovery list, for each capability file in that pack's `memory/` dir:
- Target page: `knowledge-base/wiki/pages/<capability-slug>.md`
  - If the page exists, plan a merge (append new content under a source-attributed section)
  - If it doesn't, plan a creation with source attribution in frontmatter
- Index update: plan the entry to add to `index.md` under an appropriate section (guess from capability name: copy-voice → "Cross-Product Rules", operating-principles → "Company Foundational", product-context → "Per-Product State", etc. Use the existing index.md's section list if any; otherwise create new sections).
- Log entry: plan a one-line entry in `log.md` noting the integration.

After printing the plan, stop and ask the user to confirm with a yes/no. Do not proceed without explicit approval.

Never proceed without approval.

---

## Phase 4 — Execute integration

Only on approval.

**Scaffolding (if planned):**

Create `knowledge-base/` if missing. If state C, also write a minimal `SCHEMA.md`:

```markdown
# Knowledge Base Schema

LLM-maintained wiki per Karpathy's LLM-wiki pattern.

- `raw/` — immutable source notes (optional)
- `wiki/index.md` — routing index
- `wiki/pages/` — distilled concept pages
- `wiki/log.md` — chronological log of wiki changes

Pages use `[[page-slug]]` wikilinks to cross-reference.
```

Create `wiki/index.md` with starter sections. Create empty `wiki/log.md`. Create `wiki/pages/` directory.

**Page integration:**

**Parser selection:** read the manifest's `primitive_format` field before processing any capability file:
- `"inline-tag-v0.4"`: primitives use the inline-tag grammar — each block starts with `[type facets] content`, with optional `  > reason` continuation lines. Blocks are separated by blank lines.
- `"yaml-frontmatter-v0.3"` (or absent): primitives use the v0.3 grammar — each block is a `---` YAML frontmatter followed by body text, blocks separated by `---`.

The wiki integration content extracted is the same regardless of format (content sentence + reason). Only the extraction pattern differs. Do not sniff the format heuristically — always read `primitive_format` from the manifest first.

For each capability file:

1. Read the source file from `<pack-dir>/memory/<capability>.md`.
2. Determine target page at `knowledge-base/wiki/pages/<capability-slug>.md`.
3. If the page does not exist, create it with frontmatter:

```markdown
---
title: <Derived title from capability slug>
tags: [amp-pack, <capability>]
sources:
  - "amp-pack: <pack-slug> (creator: <creator>, installed: <date>)"
updated: <today>
---

# <Derived title>

<content from memory/<capability>.md>
```

4. If the page exists, append a new section (do not overwrite existing content):

```markdown

---

## From `<pack-slug>` (creator: <creator>, installed: <date>)

<content from memory/<capability>.md>
```

Also update the page's `sources:` frontmatter list to include the new pack reference.

**Wikilinks:**

After all pages are written, pass through each new/updated page once more and detect cross-references:
- Look for mentions of other capability slugs (e.g. a rule in `copy-voice.md` that mentions "content strategy" when a `content-strategy.md` page also exists) and insert `[[content-strategy]]` inline.
- Conservative: only add a wikilink when the referenced page exists AND the phrase is an exact or near-exact match. Do not invent wikilinks to pages that don't exist.

**Index update:**

Add an entry for each new page under the appropriate section in `index.md`. Use the existing format of the index if present, otherwise:

```markdown
- [[<page-slug>]] — <one-line description from the capability file's first paragraph or H1>
```

If the index had no matching section, add a new section header.

**Log update:**

Append one line per pack to `log.md`:

```markdown
- <YYYY-MM-DD> — integrated pack `<pack-slug>` from creator `<creator>` → <N> pages created, <M> pages merged.
```

---

## Phase 5 — Report

Print a summary:

- Wiki root: `<path>`
- Scaffold: yes / no (which files if yes)
- Pages created: list with paths
- Pages merged: list with paths and merge count
- Wikilinks added: total count
- Index entries added: count
- Log entries: count

Also print one reminder:

```
The pack's agents.md routing block in CLAUDE.md / AGENTS.md / .cursor/rules/
was written by the CLI install and is independent of this wiki integration.
You can run /amp-unpack again later; it is idempotent per (pack, page) pair.
```

---

## Rules

- Never modify `manifest.json`, `agents.md`, or any file inside the installed pack directory. The pack is read-only for this skill.
- Never remove existing wiki content. Merging always appends a new section with source attribution.
- Never create wikilinks to pages that don't exist.
- Never touch the host agent's rules file (CLAUDE.md / AGENTS.md / .cursor/rules/). That file is owned by the CLI install.
- Re-running the skill on the same pack should be idempotent: pages already merged get a duplicate-detection check on the source-attribution header. If already present, skip.
- Credential / secret scan: if any page content contains a pattern matching an API key, JWT, or secret literal, skip integration for that page and report it. Integrity failure modes surface to the user, they don't silently sneak through.

---

## Example run (state C, scaffolding + one pack)

```
/amp-unpack

Phase 1: discovering installed packs…
Found 1 pack:
  1. test-pack
     scope: project
     source: .amp/
     capabilities: 2 (copy-voice, operating-principles)
     signed: true
     installed: 2026-04-22

Phase 2: detecting wiki state…
State: C (no knowledge-base/ directory)
Will scaffold: knowledge-base/SCHEMA.md, knowledge-base/wiki/index.md,
               knowledge-base/wiki/log.md, knowledge-base/wiki/pages/

Phase 3: plan
  Scaffold (4 files)
  Create knowledge-base/wiki/pages/copy-voice.md (from test-pack/memory/copy-voice.md)
  Create knowledge-base/wiki/pages/operating-principles.md (from test-pack/memory/operating-principles.md)
  Add 2 entries to index.md under new section "From installed packs"
  Append 1 line to log.md

Proceed? (yes/no)
```
