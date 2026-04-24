---
version: 0.4
released: 2026-04-22
status: current
supersedes: amp-v0.3.md
---

# Agent Memory Protocol — v0.4

Single source of truth for AMP. This document replaces all earlier scattered pitch, spec, and framing docs. Any future version lives in this folder as `amp-v[next].md` with a later `released:` date — highest date wins.

> **Repo:** [github.com/lliu56/amp](https://github.com/lliu56/amp) · **Install:** `npm install -g @arkzero/amp` · **CLI binary:** `amp`

---

## Part 1 — Pitch (why AMP exists)

### One-liner

> "What if you could upload your memory? Okay maybe not yours, but your AI agent's memory?"

### 2026 context

2026 is the year AI agent memory became a first-class thing.

- Anthropic shipped Claude Memory to every account (March 2026).
- Claude Code got Auto Dream — the agent writes its own notes between sessions.
- Anthropic's Memory Tool in the API — agents pull memory on demand.
- Graph memory went from experimental to production. Google's TurboQuant sped it 8x.
- Research anchors: Mem0's *State of AI Agent Memory 2026*, arXiv *Memory in the Age of AI Agents*.
- Every lab, every IDE, every framework is racing to build memory.

### The pain

No unified protocol to move memory between people. Goes both ways.

- **Forward.** Your memory is siloed. Vendor-captive. Your Claude memory doesn't move to Cursor. Cursor doesn't move to Codex.
- **Reverse.** Experts, senior engineers, founders — their memory is valuable. No way to install it. No standard to pull it in.

Code has GitHub. Packages have npm. Songs have Spotify. Agent memory has nothing.

### Why brute force fails (5 attempts)

| # | Attempt | Why it fails |
|---|---|---|
| BF1 | "Just upload your memory folder to GitHub" | Raw dump. No curation, no structure, no domain slice. 200 files, half from dead projects, no way to tell current from abandoned. |
| BF2 | "Just share your CLAUDE.md" (Karpathy, 16.5k stars Jan 2026) | Flat markdown. No structure, no verification, no signing. Manual copy-paste install collides with the buyer's existing config. |
| BF3 | "Add an ontology — rules, persona, facts, procedures" | Borrowed categories overlap. Two people tag the same line differently. The registry breaks. Is "always use TypeScript" a rule or a procedure? Nobody agrees. |
| BF4 | "Add a rigid schema with `when:` conditions" | Real memory doesn't work like that. Context is subtle and already in the text. An em-dash ban needs 15 `when:` conditions to cover copy, comments, PRs, decks. |
| BF5 | "Share the memory openly and trust it" | Prompt injection is now a live ecosystem threat. Stats below. |

**BF5 — the security floor:**

- Snyk ToxicSkills audit: **36%** of 3,984 ClawHub skills scanned contained detectable prompt injection. **1,467** outright malicious payloads. 91% combined prompt injection with traditional malware.
- Cisco AI Defense: **26%** of 31,000 OpenClaw skills had at least one vulnerability. Nine critical findings in the #1 skill alone.
- **SOUL.md killer example.** Attackers fragment malicious payloads across OpenClaw's SOUL.md and MEMORY.md. Each line looks benign in isolation. Assembled at runtime, they become an executable instruction chain — time-shifted logic bombs hidden inside memory files. Install a popular skill, a week later a tool call arrives, another benign line, together they form an instruction, your agent runs curl to an attacker server with your env vars in the body. Live in the wild, confirmed by Snyk.

### The actual solution — AMP

First-principled. A piece of memory is linguistically doing one of four things:

- **goal** — intent
- **claim** — assertion
- **directive** — instruction
- **demonstration** — example

Tested on 79 real memory files across 9 locations. **0% unclassifiable.**

- Context lives inside the text. No separate `when:` field.
- Packs organized by semantic cluster — files named by what the knowledge *is*, not by primitive type.
- Ed25519 signed. Server-side re-verification. Tampered packs rejected.
- Open spec, anyone can implement.
- Install primitive works: `amp install --from-path ./pack` (or a registry CLI like `mm install @creator/pack` on MemoryMarket) → **1.8 seconds** to activation.

Example: *"In any copy, never use em dashes."* One sentence. The "any copy" IS the context. No schema needed. Agent parses it, applies it, done.

---

## Part 2 — Spec (how AMP works)

### What AMP is (technical)

AMP (Agent Memory Protocol) is a format for packaging and transferring AI agent memory. A pack is a signed directory of typed memory files that a developer installs into their coding agent with a single command.

AMP owns the **transfer layer** — the pack format, signing, and install contract. The distillation (wiki → pack) and host integration (pack → agent) are adapters on either side.

### Three-phase transfer model

```
Creator's Karpathy wiki
  ↓ [/amp-capture skill — distillation]
AMP pack (signed, structured)
  ↓ [amp install — transfer layer]
Buyer's agent (CLAUDE.md managed block + .amp/<slug>/ subtree)
```

### What changed from v0.3

The per-primitive YAML frontmatter block is replaced with a single inline-tag line. A 100-primitive pack drops from ~85% scaffolding to ~15%. The cluster file's YAML frontmatter (one block at the top of each file) is unchanged. The `source` field is lifted from per-primitive to the cluster frontmatter. The manifest gains one new field (`primitive_format`) that switches readers between v0.3 and v0.4. v0.3 packs continue to install without change.

### Pack layout

```
<pack-name>/
  manifest.json           ← required
  agents.md               ← required
  memory/
    operating-principles.md   ← required
    copy-voice.md             ← required if writing rules exist
    content-strategy.md       ← required if content strategy exists
    product-context.md        ← required if product facts exist
    ops-tools.md              ← required if ops/tool config exists
    demonstrations.md         ← optional (only if demo units exist)
```

`manifest.layout` must be `"semantic-cluster"`. Each file in `memory/` covers one capability domain (what-kind-of-task), not one primitive type. Primitives mix within files.

### manifest.json

```json
{
  "name": "pack-slug",
  "title": "My Pack Title",
  "version": { "number": 1 },
  "layout": "semantic-cluster",
  "primitive_format": "inline-tag-v0.4",
  "created": "YYYY-MM-DD",
  "sources": ["list of source files used during distillation"],
  "agents_file": "agents.md",
  "agents": ["claude-code"],
  "capability_files": ["operating-principles.md", "copy-voice.md"],
  "primitive_counts": {
    "goal": 0,
    "claim": 0,
    "directive": 0,
    "demonstration": 0,
    "dropped_action_log": 0,
    "dropped_duplicate": 0
  },
  "signed": false,
  "signature": ""
}
```

- **Required fields:** `name`, `title`, `layout`, `capability_files`, `agents_file`, `agents`.
- **`primitive_format`:** `"inline-tag-v0.4"` for new packs. When absent, defaults to `"yaml-frontmatter-v0.3"` so v0.3 packs still verify and install.
- **Signing fields:** `signed` (bool) and `signature` (base64url string). Both empty/false before `amp sign` runs.
- **Name must match:** `^[a-z0-9][a-z0-9-]{0,63}$`

### agents.md — the routing table

Consuming agent reads this to know which capability files to load for which task type. The installer inlines this file verbatim into the host rules file (CLAUDE.md / AGENTS.md / etc.) as a managed block.

```markdown
# AMP Routing — <pack-name>

## Always load
- operating-principles.md — <one-line description>

## Route by task type

| If the task involves... | Load |
|---|---|
| Writing anything (copy, posts, scripts, headlines) | copy-voice.md |
| Content strategy (angle, framing, channel, launch) | content-strategy.md |
| Product facts (positioning, pricing, features) | product-context.md |
| Ops or automation (email, credentials, tools) | ops-tools.md |
| Reviewing approved examples or tone matching | demonstrations.md |
```

Only include rows for capability files that exist. `operating-principles.md` is always in Always-load.

### Capability files

Each file in `memory/` is a cluster file. Frontmatter declares what's in it. Body is one or more inline-tag primitive blocks, separated by blank lines.

```yaml
---
type: cluster
applies_to: <one-line description of what tasks this file covers>
source: self
primitive_counts:
  directive: N
  goal: N
  claim: N
  demonstration: N
---
```

`source` is lifted from per-primitive (v0.3) to cluster level. All primitives in a cluster file share the same source. Valid values: `self` | `imported` | `inferred`.

---

## Part 3 — The four primitives (inline-tag format)

### Tag grammar

```
[<type> <facet1>, <facet2>, <facet3>] <content>
  > <reason — optional, two-space indent + > marker>
```

- `<type>` is the first token after `[`. Required. One of: `goal | claim | directive | demonstration | demo` (`demo` is an alias for `demonstration`).
- `<facetN>` are positional, comma-separated, defined per type below. All are optional unless noted.
- `<content>` is everything after the closing `]` to end of line (or until `{` opens for multi-line demos).
- `> <reason>` is an optional continuation line. Two-space indent + `>` marker. Multiple `>` lines allowed and concatenate with single newlines.
- **Facet order is positional and enforced.** `[directive must, org, permanent]` is valid. `[directive permanent, must, org]` is INVALID.

### `goal`

A statement of what to optimize for, an active priority, or an operating principle.

```
[goal <force>, <scope>, <stability>]
```

Facets: `<force>` (default `should`), `<scope>` (`org|project|user`, default `project`), `<stability>` (`permanent|seasonal|tactical`, default `permanent`).

Sentence patterns (pick one): `In [context], the goal is to [outcome].` / `Optimize [X] over [Y].` / `Default [stance/cadence]: [behavior].`

**Example:**
```
[goal should, project, permanent] Optimize for virality over polish on every content decision.
  > Traffic volume is the constraint, not conversion rate.
```

Qualifies: operating principles, active priorities, open bets, stated directions.
Does not qualify: claims dressed as goals, directives dressed as goals, action-log narration.

### `claim`

A factual assertion about the world, a product, a user, or an organization.

```
[claim <stability>]
```

Facets: `<stability>` (`permanent|tactical`, default `permanent`).

Sentence pattern: `[Subject] is / has [assertion].`

**Example:**
```
[claim permanent] Arkzero was founded in 2026 as a one-person AI company.
```

Qualifies: technical config facts, product positioning, identity/preference, persistent state.
Does not qualify: instructions (directives), goals, examples (demonstrations).

### `directive`

An instruction for what the consuming agent should or should not do.

```
[directive <force>, <scope>, <stability>]
```

Facets: `<force>` (`must|should|may`, default `should`), `<scope>` (`session|project|user|org`, default `project`), `<stability>` (`permanent|seasonal|tactical`, default `permanent`).

Sentence patterns (pick one): `In [context], [always|never] [behavior].` / `When [condition], prefer [behavior] over [alternative].`

**Example:**
```
[directive must, org, permanent] In all copy, never use em dashes.
  > Org-wide ban on AI-cliche patterns.
```

Qualifies: bans, required procedures, conditional preferences, edit-scope rules.
Does not qualify: claims dressed as instructions, examples, goal statements without context+behavior triple.

### `demonstration`

A whole artifact showing a pattern to match or avoid.

**Single-line:**
```
[demo <valence>, illustrates: <directive-id>] <artifact — one line>
  > <annotation — optional>
```

**Multi-line (brace block):**
```
[demo <valence>, illustrates: <directive-id>] {
<full artifact body — verbatim, no parsing inside braces>
}
  > <annotation — optional>
```

Facets: `<valence>` (`positive|negative|mixed`, **required**), `illustrates: <id>` (optional, key-value form).

Rules for multi-line brace blocks:
- Opening `{` MUST be on the same line as the closing `]`.
- Closing `}` MUST be at column 0.
- Body inside braces is verbatim — `[`, `]`, `>` characters inside are not parsed.
- `> annotation` lines come AFTER the closing `}`, indented two spaces.

**Example:**
```
[demo negative, illustrates: em-dash-ban] {
  Original: "We're not just shipping — we're transforming."
  After rule: "We're shipping a new format."
}
  > Em-dash version reads as AI-slop; direct version is concrete.
```

Qualifies: approved one-liners, rejected drafts with annotations, before/after rewrites.
Does not qualify: rules (directives), assertions (claims), goals.

### Minimal valid capability file

```markdown
---
type: cluster
applies_to: writing style, voice, copy formatting rules
source: self
primitive_counts:
  directive: 2
  goal: 0
  claim: 0
  demonstration: 1
---

[directive must, org, permanent] In all written output, never use em dashes.
  > Org-wide writing ban — em dashes are an AI-cliche pattern.

[directive must, org, permanent] In Reddit posts, lead with findings or value, not product description.
  > Posts that open with product description perform worse than posts leading with data or insight.

[demo negative, illustrates: em-dash-ban] {
  Original: "We're not just shipping — we're transforming."
  Approved: "We're shipping a new format."
}
  > Show the difference instead of restating the rule.
```

---

## Part 4 — Non-primitive: action-log

Raw work narration — "Ran /social-news-post pipeline," "Committed fix to X," "Deployed Y." These entries are distillation fuel, not pack content. The `/amp-capture` skill drops them silently. Exception: if an action-log bullet contains an embedded Li-quote, extract the quote as a new memory unit before dropping the narration.

---

## Part 5 — Parser spec

Capability file body parser, line by line:

1. Split into logical blocks. A block is one primitive.
2. A block starts at a line matching `/^\[(\w+)([^\]]*?)\]\s*(.*)$/`.
   - Group 1: type token.
   - Group 2: facet string (may be empty, or start with a space then comma-separated tokens, or contain `key: value` for `illustrates:`).
   - Group 3: rest of line — content (or `{` if a multi-line demo opens).
3. If group 3 ends with `{`, consume lines verbatim until a line that is exactly `}` at column 0. The captured body is the demonstration content.
4. After the content / closing `}`, consume continuation lines matching `/^\s{2}>\s?(.*)$/` and join them into the reason field.
5. A blank line ends the block.

**Validation rules:**

- `goal` block: content must contain at least one of: `the goal is to`, `optimize`, `default`.
- `claim` block: content starts with a noun phrase and contains `is` or `has`.
- `directive` block: content matches `(In|When)\s.*(always|never|prefer)` pattern.
- `demonstration` block: must have `valence` facet (`positive|negative|mixed`). Body required.
- No primitive block contains credential-like patterns: `sk-[A-Za-z0-9]{20,}`, `re_[A-Za-z0-9]{20,}`, `phc_[A-Za-z0-9]{20,}`, `=\s*['"][A-Za-z0-9]{32,}`.
- Facet order is positional per type — validator reports position violation with the message: `expected <facet-name> at position <N> for <type>, got <value>`.

**Validation report format:**
```
PASS: [N] primitives valid
FAIL: [N] primitives failed validation
  - [unit ID] — REASON: [specific failure]
WARN: [N] ambiguous units still unresolved — awaiting human review
```

---

## Part 6 — Signing

Before distribution, sign the pack with `amp sign`:

```bash
amp keygen                          # generate Ed25519 keypair (first time only)
amp sign <pack-dir>                 # sign → writes signed:true + signature to manifest.json
amp verify <pack-dir> --public-key <file>  # verify (any machine, no MM infrastructure)
```

**Signing payload (deterministic):**
```
JSON.stringify(manifest without "signed"/"signature" fields)
+ "\n"
+ sha256(file_1) + "\n" + sha256(file_2) + ...   (all files except manifest.json, sorted by relative path ASC)
```

**Algorithm:** Ed25519. Key format: PKCS8 PEM (private) / SPKI PEM (public).

**Independent verification (no CLI needed):**
```js
const { signed, signature, ...signable } = JSON.parse(fs.readFileSync('manifest.json'));
const payload = [JSON.stringify(signable), ...sortedFileHashes].join('\n');
const valid = crypto.verify(null, Buffer.from(payload), pubKey, Buffer.from(signature, 'base64url'));
```

---

## Part 7 — Installation

```bash
# Install a local AMP pack (reference CLI — local path only)
amp install --from-path <pack-dir>

# Global (user scope)
amp install --from-path <pack-dir> --scope user

# Target a specific agent explicitly
amp install --from-path <pack-dir> --agent claude-code
```

**Registry installs** are delegated to registry-specific CLIs. The open-source `amp` CLI installs from local paths only. For the MemoryMarket registry, use the `mm` CLI (`mm install @creator/slug`) — contract specified in [`mm-amp-integration.md`](mm-amp-integration.md).

**What install does:**
1. Validates pack (layout, agents.md, capability files, signed status for registry).
2. Extracts pack to `.amp/<slug>/` subtree in the project root.
3. Appends managed block to host rules file (CLAUDE.md / AGENTS.md / .windsurfrules / ~/.openclaw/workspace/AGENTS.md for OpenClaw).

Agents that use a home-directory workspace (OpenClaw) always install user-scope. The managed block is written to `~/.openclaw/workspace/AGENTS.md` regardless of the `--scope` flag.

**Managed block format:**
```markdown
<!-- amp:begin @creator/slug -->
[agents.md content inlined verbatim]

> Pack files: .amp/slug/memory/
<!-- amp:end @creator/slug -->
```

**Uninstall:** `amp uninstall <slug>` — removes managed block + deletes `.amp/<slug>/` directory.

### Validation rules (installer enforces)

| Gate | Condition | Error |
|---|---|---|
| 1 | manifest.json exists | Missing manifest.json |
| 2 | manifest.json valid JSON | manifest.json is not valid JSON |
| 3 | layout == "semantic-cluster" | Pack layout is '...', expected 'semantic-cluster' |
| 4 | agents.md exists | Missing agents.md |
| 5 | all capability_files present under memory/ | Missing capability file: memory/... |
| 6 (registry only) | signed == true | Pack is not signed |

---

## Part 8 — CLI reference

All commands are provided by the `amp` binary (`npm install -g @arkzero/amp`, requires Node.js 18+).

### `amp keygen`

Generate an Ed25519 signing keypair. Default output: `~/.amp/keys/signing.key` + `~/.amp/keys/signing.pub`.

```bash
amp keygen
amp keygen --out ./my-key.key    # custom path
amp keygen --force               # overwrite existing key
```

### `amp sign <pack-dir>`

Sign an AMP pack. Writes `signed: true` and `signature` into `manifest.json`.

```bash
amp sign ./my-pack
amp sign ./my-pack --key ./my-key.key
AMP_PRIVATE_KEY="$(cat ~/.amp/keys/signing.key)" amp sign ./my-pack
```

### `amp verify <pack-dir>`

Verify a pack's signature. Exits 0 if valid, 1 if invalid or tampered.

```bash
amp verify ./my-pack --public-key ~/.amp/keys/signing.pub
amp verify ./my-pack --public-key "-----BEGIN PUBLIC KEY-----\n..."
AMP_PUBLIC_KEY="$(cat ~/.amp/keys/signing.pub)" amp verify ./my-pack
```

### `amp install --from-path <pack-dir>`

Install a local AMP pack into the current project's coding agent.

```bash
amp install --from-path ./my-pack
amp install --from-path ./my-pack --scope user          # install globally for your user
amp install --from-path ./my-pack --agent claude-code   # target specific agent
```

Supported agents: `claude-code`, `codex`, `cursor`, `windsurf`, `openclaw`. Auto-detected from project markers (`CLAUDE.md`, `AGENTS.md`, `.cursor/`, `.windsurfrules`) or `~/.openclaw/` if `--agent` isn't passed. OpenClaw always installs user-scope and writes the managed block to `~/.openclaw/workspace/AGENTS.md`.

### `amp inspect <slug>`

Show metadata and tamper status of an installed pack.

```bash
amp inspect my-pack
amp inspect my-pack --scope user
```

### `amp uninstall <slug>`

Remove an installed pack. Cleans the managed block from the agent's rules file and deletes the pack directory.

```bash
amp uninstall my-pack
amp uninstall my-pack --scope user
```

### Environment variables

| Variable | Purpose |
|---|---|
| `AMP_PRIVATE_KEY` | Private key PEM string — overrides `--key` flag in `sign` |
| `AMP_PUBLIC_KEY` | Public key PEM string — overrides `--public-key` flag in `verify` |

---

## Part 9 — Credential scanner

The `/amp-capture` skill runs a credential scan on every extracted unit before writing it to the pack. Any unit containing a pattern that looks like a live credential is rejected with an error (not a warning).

**Reject patterns:**
- `sk-` prefix (OpenAI API key)
- `re_` prefix (Resend API key)
- `phc_` prefix (PostHog key)
- `key = <value>` or `token = <value>` where value is 20+ chars and alphanumeric
- Any value that looks like `AKIA` (AWS key prefix)

**False positive guard:** If a unit contains a redacted form (`sk-***`, `re_***`, `[REDACTED]`) it passes. If a unit discusses key names without values (e.g., "set OPENAI_API_KEY in .env"), it passes.

---

## Part 10 — Distillation shape guide (source → unit boundary)

| Source shape | Unit boundary | Notes |
|---|---|---|
| `philosophy` | One bolded principle + prose = one unit | Li's Takes section: each topic = one unit |
| `priorities` | One bullet per list = one unit | Drop "Recently shipped" as action-log |
| `feedback` | Whole file = one unit | Already atomic |
| `project` | Whole file = one unit | Exception: `project_memorymarket_v3.md` → split at sub-section |
| `reference` | Whole file = one unit | |
| `log` | One bullet per date-header = one unit | Pre-classify each bullet; drop action-log |
| `marketing-master` | One section = one unit; "Approved Examples" → one demo per example | |

### Capability file routing rules (priority order, first match wins)

1. `credential / API key / token / n8n / Resend / PostHog / .env / email address / deploy` → **ops-tools.md**
2. `em dash / voice / tone / style / format / tagline / draft / slop / banned / pattern / vocabulary / phrasing` → **copy-voice.md**
2.5 `theme / color / palette / visual / brand / design / font / background` → **copy-voice.md** (subtype: visual-brand)
3. `angle / framing / story / launch / post / CTA / channel / lead with / closed loop / narrative` → **content-strategy.md**
4. Factual assertion about a product (claim primitive) → **product-context.md**
5. Goal / priority / operating principle → **operating-principles.md**
6. Approved artifact → **demonstrations.md**

### De-duplication (log extraction only)

When extracting directive-candidates from log entries, check each against `raw/feedback_*.md` files. If key nouns + verbs overlap >80%, mark as `DUPLICATE — skip`. The canonical source is the feedback file.

---

## Part 11 — Migration from v0.3

v0.3 packs in the wild continue to install unchanged.

- `manifest.json` `primitive_format` field switches the reader.
  - Absent or `"yaml-frontmatter-v0.3"` → use the v0.3 reader (YAML frontmatter per primitive, blocks separated by `---`).
  - `"inline-tag-v0.4"` → use the v0.4 reader (inline-tag blocks, separated by blank lines).
- The CLI does not read primitive content — no changes needed there.
- The `/amp-unpack` skill reads `primitive_format` from the manifest to pick which parser to use when integrating into the wiki.
- The `/amp-capture` skill always writes v0.4 from now on. There is no flag to write v0.3.
- No migration tool. v0.3 packs stay v0.3 forever. New packs are v0.4.

---

## Part 12 — Skills

AMP ships two Claude Code skills for the judgment-heavy ends of the flow. Drop either skill file into your `.claude/skills/` directory to activate it.

### `/amp-capture`

Distills a Karpathy-style wiki (`knowledge-base/wiki/`) or raw memory folder into a valid v0.4 pack. Runs from inside a host agent (Claude Code, Codex). Handles all four primitives, routes content to the correct capability file, runs the credential scanner (Part 9) on every extracted unit, and writes v0.4 inline-tag format only.

```
skills/amp-capture/SKILL.md
```

**Use when:** you want to publish your agent's memory as a distributable AMP pack.

### `/amp-unpack`

After `amp install`, integrates the installed pack into a Karpathy wiki at `knowledge-base/wiki/`. Reads the routing table from `agents.md`, updates `wiki/index.md`, and adds wikilinks to affected pages. Scaffolds a new wiki if one does not exist. Idempotent — safe to run again after pack updates.

```
skills/amp-unpack/SKILL.md
```

**Use when:** you've installed a pack and want to merge its memory units into your own wiki rather than loading them purely through the managed block.

---

## Part 13 — Registries

AMP is registry-agnostic. Any server that implements the integration contract at [`mm-amp-integration.md`](mm-amp-integration.md) can host, verify, and serve packs.

The default registry is [MemoryMarket](https://memorymarket.co), which adds a public key registry with GitHub + Stripe identity binding, server-side re-scanning and revocation, and discovery / browse / creator payouts.

---

## Links

- **GitHub repo:** https://github.com/lliu56/amp
- **Issues:** https://github.com/lliu56/amp/issues
- **Previous version (archived):** [`amp-v0.3.md`](amp-v0.3.md)
- **Registry integration contract:** [`mm-amp-integration.md`](mm-amp-integration.md)
- **Distillation skill:** [`../skills/amp-capture/SKILL.md`](../skills/amp-capture/SKILL.md)
- **Integration skill:** [`../skills/amp-unpack/SKILL.md`](../skills/amp-unpack/SKILL.md)
- **CLI source:** [`../src/`](../src/)
