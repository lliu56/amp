# Agent Memory Protocol — Specification v0.4

**Status:** locked 2026-04-22 (v0.4 — inline-tag primitive format)
**Supersedes:** amp-v0.3-spec.md

---

## What AMP is

AMP (Agent Memory Protocol) is a format for packaging and transferring AI agent memory. A pack is a signed directory of typed memory files that a developer installs into their coding agent with a single command.

**Why it exists:** Each developer's coding agent accumulates hard-won knowledge (behavioral rules, product facts, voice constraints, operating principles). That knowledge is currently locked to one developer's machine. AMP lets creators package and distribute that knowledge to buyers who install it locally, without cloud round-trips during inference.

**Three-phase model:**

```
Creator's Karpathy wiki
  ↓ [/amp-capture skill — distillation]
AMP pack (signed, structured)
  ↓ [mm install — transfer layer]
Buyer's agent (CLAUDE.md managed block + .memorymarket/<slug>/ subtree)
```

AMP owns the transfer layer — the pack format, signing, and install contract. The distillation (Karpathy → pack) and host integration (pack → agent) are adapters on either side.

---

## What changed in v0.4 (from v0.3)

The per-primitive YAML frontmatter block is replaced with a single inline-tag line. A 100-primitive pack drops from ~85% scaffolding to ~15%. The cluster file's YAML frontmatter (one block at the top of each file) is unchanged. The `source` field is lifted from per-primitive to the cluster frontmatter.

The manifest gains one new field (`primitive_format`) that switches readers between v0.3 and v0.4. v0.3 packs continue to install without change.

---

## Pack layout

A valid AMP v0.4 pack is a directory with this structure:

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

---

## manifest.json

```json
{
  "name": "pack-slug",
  "version": "0.1.0",
  "layout": "semantic-cluster",
  "primitive_format": "inline-tag-v0.4",
  "created": "YYYY-MM-DD",
  "sources": ["list of source files used during distillation"],
  "capability_files": ["operating-principles.md", "copy-voice.md"],
  "agents_file": "agents.md",
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

**Required fields:** `name`, `layout`, `capability_files`, `agents_file`.
**`primitive_format`:** `"inline-tag-v0.4"` for new packs. When absent, defaults to `"yaml-frontmatter-v0.3"` so v0.3 packs still verify and install.
**Signing fields:** `signed` (bool) and `signature` (base64url string). Both empty/false before `mm sign` runs.
**Name must match:** `^[a-z0-9][a-z0-9-]{0,63}$`

---

## agents.md

The routing table. The consuming agent reads this to know which capability files to load for which task type. The MemoryMarket installer inlines this file verbatim into the host rules file (CLAUDE.md / AGENTS.md / etc.) as a managed block.

**Required format:**

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

Only include rows for capability files that exist in the pack. `operating-principles.md` is always in the Always-load section.

---

## Capability files

Each file in `memory/` is a cluster file. Frontmatter declares what's in it. Body is one or more inline-tag primitive blocks, separated by blank lines.

**Cluster file frontmatter:**

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

`source` is lifted from per-primitive (v0.3) to the cluster level. All primitives in a cluster file share the same source. Valid values: `self` | `imported` | `inferred`.

---

## The four primitives — inline-tag format

### Tag grammar

```
[<type> <facet1>, <facet2>, <facet3>] <content>
  > <reason — optional, two-space indent + > marker>
```

- `<type>` is the first token after `[`. Required. One of: `goal | claim | directive | demonstration | demo` (`demo` is an alias for `demonstration`).
- `<facetN>` are positional, comma-separated, defined per type below. All are optional unless noted.
- `<content>` is everything after the closing `]` to end of line (or until `{` opens for multi-line demos).
- `> <reason>` is an optional continuation line. Two-space indent + `>` marker. Multiple `>` lines allowed and concatenate with single newlines.
- **Facet order is positional and enforced.** `[directive must, org, permanent]` is valid. `[directive permanent, must, org]` is INVALID. The validator reports: `expected <force> at position 1 for directive, got <permanent>`.

---

### `goal`

A statement of what to optimize for, an active priority, or an operating principle.

**Tag:**
```
[goal <force>, <scope>, <stability>]
```
Facets: `<force>` (default `should`), `<scope>` (`org|project|user`, default `project`), `<stability>` (`permanent|seasonal|tactical`, default `permanent`).

**Sentence patterns (pick one):**
```
In [context], the goal is to [outcome].
Optimize [X] over [Y].
Default [stance/cadence]: [behavior].
```

**Example:**
```
[goal should, project, permanent] Optimize for virality over polish on every content decision.
  > Traffic volume is the constraint, not conversion rate.
```

**Qualifies:** operating principles, active priorities, open bets, stated directions.
**Does not qualify:** claims dressed as goals, directives dressed as goals, action-log narration.

---

### `claim`

A factual assertion about the world, a product, a user, or an organization.

**Tag:**
```
[claim <stability>]
```
Facets: `<stability>` (`permanent|tactical`, default `permanent`).

**Sentence pattern:**
```
[Subject] is / has [assertion].
```

**Example:**
```
[claim permanent] Arkzero was founded in 2026 as a one-person AI company.
```

**Qualifies:** technical config facts, product positioning, identity/preference, persistent state.
**Does not qualify:** instructions (those are directives), goals, examples (those are demonstrations).

---

### `directive`

An instruction for what the consuming agent should or should not do.

**Tag:**
```
[directive <force>, <scope>, <stability>]
```
Facets: `<force>` (`must|should|may`, default `should`), `<scope>` (`session|project|user|org`, default `project`), `<stability>` (`permanent|seasonal|tactical`, default `permanent`).

**Sentence patterns (pick one):**
```
In [context], [always|never] [behavior].
When [condition], prefer [behavior] over [alternative].
```

**Example:**
```
[directive must, org, permanent] In all copy, never use em dashes.
  > Org-wide ban on AI-cliche patterns.
```

**Qualifies:** bans, required procedures, conditional preferences, edit-scope rules.
**Does not qualify:** claims dressed as instructions, examples, goal statements without context+behavior triple.

---

### `demonstration`

A whole artifact showing a pattern to match or avoid.

**Single-line tag:**
```
[demo <valence>, illustrates: <directive-id>] <artifact — one line>
  > <annotation — optional>
```

**Multi-line tag (brace block):**
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

**Qualifies:** approved one-liners, rejected drafts with annotations, before/after rewrites.
**Does not qualify:** rules (those are directives), assertions (those are claims), goals.

---

## Example: minimal valid capability file

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

## Non-primitive: action-log

Raw work narration — "Ran /social-news-post pipeline," "Committed fix to X," "Deployed Y." These entries are distillation fuel, not pack content. The `/amp-capture` skill drops them silently. Exception: if an action-log bullet contains an embedded Li-quote, extract the quote as a new memory unit before dropping the narration.

---

## Parser spec (for the skills' validation phase)

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

## Migration from v0.3

v0.3 packs in the wild continue to install unchanged. The migration strategy:

- `manifest.json` `primitive_format` field switches the reader.
  - Absent or `"yaml-frontmatter-v0.3"` → use the v0.3 reader (YAML frontmatter per primitive, blocks separated by `---`).
  - `"inline-tag-v0.4"` → use the v0.4 reader (inline-tag blocks, separated by blank lines).
- The CLI does not read primitive content — no changes needed there.
- The `/amp-unpack` skill reads `primitive_format` from the manifest to pick which parser to use when integrating into the wiki.
- The `/amp-capture` skill always writes v0.4 from now on. There is no flag to write v0.3.
- No migration tool. v0.3 packs stay v0.3 forever. New packs are v0.4.

---

## Signing

Before distribution, sign the pack with `mm sign`:

```bash
mm keygen                          # generate Ed25519 keypair (first time only)
mm sign <pack-dir>                 # sign → writes signed:true + signature to manifest.json
mm verify <pack-dir> --public-key <file>  # verify (any machine, no MM infrastructure)
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

## Installation

```bash
# From MemoryMarket registry (requires auth + signed pack)
mm install @creator/slug

# From local directory (development, skips auth + signing check)
mm install --from-path <pack-dir>

# Global (user scope)
mm install @creator/slug --scope user
```

**What install does:**
1. Validates pack (layout, agents.md, capability files, signed status for registry)
2. Extracts pack to `.memorymarket/<slug>/` subtree in the project root
3. Appends managed block to host rules file (CLAUDE.md / AGENTS.md / .windsurfrules)

**Managed block format (in CLAUDE.md):**
```markdown
<!-- amp:begin @creator/slug -->
[agents.md content inlined verbatim]

> Pack files: .memorymarket/slug/memory/
<!-- amp:end @creator/slug -->
```

**Uninstall:**
```bash
mm uninstall <slug>
```
Removes managed block + deletes `.memorymarket/<slug>/` directory.

---

## Validation rules (installer enforces)

| Gate | Condition | Error |
|---|---|---|
| 1 | manifest.json exists | Missing manifest.json |
| 2 | manifest.json valid JSON | manifest.json is not valid JSON |
| 3 | layout == "semantic-cluster" | Pack layout is '...', expected 'semantic-cluster' |
| 4 | agents.md exists | Missing agents.md |
| 5 | all capability_files present under memory/ | Missing capability file: memory/... |
| 6 (registry only) | signed == true | Pack is not signed |

---

## Credential scanner

The `/amp-capture` skill runs a credential scan on every extracted unit before writing it to the pack. Any unit containing a pattern that looks like a live credential is rejected with an error (not a warning).

**Reject patterns:**
- `sk-` prefix (OpenAI API key)
- `re_` prefix (Resend API key)
- `phc_` prefix (PostHog key)
- `key = <value>` or `token = <value>` where value is 20+ chars and alphanumeric
- Any value that looks like `AKIA` (AWS key prefix)

**False positive guard:** If a unit contains a redacted form (`sk-***`, `re_***`, `[REDACTED]`) it passes. If a unit discusses key names without values (e.g., "set OPENAI_API_KEY in .env"), it passes.

---

## Distillation shape guide (source → unit boundary)

| Source shape | Unit boundary | Notes |
|---|---|---|
| `philosophy` | One bolded principle + prose = one unit | Li's Takes section: each topic = one unit |
| `priorities` | One bullet per list = one unit | Drop "Recently shipped" as action-log |
| `feedback` | Whole file = one unit | Already atomic |
| `project` | Whole file = one unit | Exception: project_memorymarket_v3.md → split at sub-section |
| `reference` | Whole file = one unit | |
| `log` | One bullet per date-header = one unit | Pre-classify each bullet; drop action-log |
| `marketing-master` | One section = one unit; "Approved Examples" → one demo per example | |

---

## Capability file routing rules (priority order, first match wins)

1. `credential / API key / token / n8n / Resend / PostHog / .env / email address / deploy` → **ops-tools.md**
2. `em dash / voice / tone / style / format / tagline / draft / slop / banned / pattern / vocabulary / phrasing` → **copy-voice.md**
2.5 `theme / color / palette / visual / brand / design / font / background` → **copy-voice.md** (subtype: visual-brand)
3. `angle / framing / story / launch / post / CTA / channel / lead with / closed loop / narrative` → **content-strategy.md**
4. Factual assertion about a product (claim primitive) → **product-context.md**
5. Goal / priority / operating principle → **operating-principles.md**
6. Approved artifact → **demonstrations.md**

---

## De-duplication (log extraction only)

When extracting directive-candidates from log entries, check each against `raw/feedback_*.md` files. If key nouns + verbs overlap >80%, mark as `DUPLICATE — skip`. The canonical source is the feedback file.

---

## Creating your first pack (quick start)

1. **Run `/amp-capture`** with your source files → get a draft pack in `workspace/amp-packs/<name>/`
2. **Review the Phase 3→4 human review pause** — drop or reclassify any misrouted units
3. **Check `agents.md`** — routing table must have a row for every task type your buyers will ask
4. **Generate keypair:** `mm keygen` (once)
5. **Sign:** `mm sign workspace/amp-packs/<name>`
6. **Test install:** `mm install --from-path workspace/amp-packs/<name>` in a scratch project
7. **Verify the agent uses it:** ask the agent to write something that should trigger copy-voice.md rules. Confirm they fire.
8. **Publish:** `mm publish` (MemoryMarket registry — requires auth)
