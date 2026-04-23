---
version: 0.3
released: 2026-04-21
status: superseded
superseded_by: amp-v0.4.md
---

# Agent Memory Protocol — Specification v0.3

> **SUPERSEDED** by [amp-v0.4.md](amp-v0.4.md). Preserved for archival. v0.3 packs continue to install via the `primitive_format` manifest field — readers auto-switch when it's absent or set to `"yaml-frontmatter-v0.3"`.

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

## Pack layout

A valid AMP v0.3 pack is a directory with this structure:

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

Each file in `memory/` is a cluster file. Frontmatter declares what's in it. Body is one or more primitive blocks separated by `---`.

**Cluster file frontmatter:**

```yaml
---
type: cluster
applies_to: <one-line description of what tasks this file covers>
primitive_counts:
  directive: N
  goal: N
  claim: N
  demonstration: N
---
```

---

## The four primitives

### `goal`

A statement of what to optimize for, an active priority, or an operating principle. Goals are the intent substrate — when directives conflict in application, the goal is the tiebreaker.

**Frontmatter:**
```yaml
---
type: goal
force: should          # goals inform, rarely mandate
scope: org|project|user
stability: permanent|seasonal|tactical
source: self|imported|inferred
---
```

**Sentence patterns (pick one):**
```
In [context], the goal is to [outcome].
Optimize [X] over [Y].
Default [stance/cadence]: [behavior].
```

**Qualifies:** operating principles, active priorities, open bets, stated directions, time-bounded commitments.
**Does not qualify:** claims dressed as goals, directives dressed as goals, action-log narration.

---

### `claim`

A factual assertion about the world, a product, a user, or an organization. Claims are the pack's information substrate.

**Frontmatter:**
```yaml
---
type: claim
stability: permanent|tactical
source: self|imported|inferred
---
```

**Sentence pattern:**
```
[Subject] is / has [assertion].
```

**Qualifies:** technical config facts, product positioning, identity/preference, persistent state.
**Does not qualify:** instructions (those are directives), goals, examples (those are demonstrations).

---

### `directive`

An instruction for what the consuming agent should or should not do. Directives are the behavioral core — they shape future agent action.

**Frontmatter:**
```yaml
---
type: directive
force: must|should|may
scope: session|project|user|org
stability: permanent|seasonal|tactical
source: self|imported|inferred
---
```

**Sentence patterns (pick one):**
```
In [context], [always|never] [behavior].
When [condition], prefer [behavior] over [alternative].
```

**Qualifies:** bans, required procedures, conditional preferences, edit-scope rules, multi-step SOPs.
**Does not qualify:** claims dressed as instructions, examples (those are demonstrations), goal statements without context+behavior triple.

---

### `demonstration`

A whole artifact showing a pattern to match or avoid. Not a rule — an example. The agent uses demonstrations as pattern-matching fuel.

**Frontmatter:**
```yaml
---
type: demonstration
valence: positive|negative|mixed   # required
illustrates: [directive-id]        # optional
source: self|imported
---
```

**Body:** the full artifact (tweet, approved copy, rejected draft, before/after, code snippet). No sentence pattern.

**Qualifies:** sample artifacts in a creator's voice, approved one-liners, rejected drafts with annotations, before/after rewrites.
**Does not qualify:** rules (those are directives), assertions (those are claims), goals.

---

## Non-primitive: action-log

Raw work narration — "Ran /social-news-post pipeline," "Committed fix to X," "Deployed Y." These entries are distillation fuel, not pack content. The `/amp-capture` skill drops them silently. Exception: if an action-log bullet contains an embedded Li-quote, extract the quote as a new memory unit before dropping the narration.

---

## Example: minimal valid capability file

```markdown
---
type: cluster
applies_to: writing style, voice, copy formatting rules
primitive_counts:
  directive: 2
  goal: 0
  claim: 0
  demonstration: 0
---

---
type: directive
force: must
scope: org
stability: permanent
source: self
---

In all written output, never use em dashes.

**Why:** Org-wide writing ban — em dashes are an AI-cliche pattern.

---

---
type: directive
force: must
scope: org
stability: permanent
source: self
---

In Reddit posts, lead with findings or value, not product description.

**Why:** Posts that open with product description perform worse than posts leading with data or insight.
```

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

When extracting directive-candidates from log entries, check each against `raw/feedback_*.md` files. If key nouns + verbs overlap >80%, mark as `DUPLICATE — skip`. The canonical source is the feedback file. Log entries rarely add behavioral information not already in feedback files; they add context and timing.

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
