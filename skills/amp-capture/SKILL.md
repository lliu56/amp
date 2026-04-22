---
name: amp-capture
description: Distill raw Arkzero memory sources into a valid AMP B-capability pack. Produces capability files (copy-voice, content-strategy, product-context, ops-tools, operating-principles), agents.md, and manifest.json in workspace/amp-packs/[pack-name]/.
triggers:
  - /amp-capture
args:
  - name: pack-name
    required: true
    description: Pack name — used in manifest.json and output directory
  - name: --sources
    required: false
    description: Comma-separated source paths. Default: auto-discover standard Arkzero locations
  - name: --out
    required: false
    description: Output directory. Default: workspace/amp-packs/[pack-name]/
---

# /amp-capture

Distill raw Arkzero memory sources into a valid AMP B-capability pack.

## Usage

```
/amp-capture [pack-name] [--sources path1,path2,...] [--out output-dir]
```

---

## Phase 1 — Source discovery

If `--sources` provided: use exactly those paths.

Otherwise auto-discover from these standard locations (in order):

1. `philosophy.md`
2. `knowledge-base/wiki/pages/current-priorities.md`
3. `knowledge-base/raw/feedback_*.md` (all)
4. `knowledge-base/raw/project_*.md` (all)
5. `knowledge-base/raw/reference_*.md` (all)
6. `main_agent_memory_logs.md` — entries after the 90-day cutoff only. Cutoff = today minus 90 days. Skip entries older than that.
7. `marketing/*/[product]-marketing.md` (all found)

Output: numbered list of discovered source files with file sizes.

---

## Phase 2 — Shape detection

For each source file, detect which shape it is:

| Shape | Detection rule |
|---|---|
| `philosophy` | Filename contains "philosophy" OR file has bolded lines (** **) as structural separators |
| `priorities` | Filename contains "current-priorities" OR has sections "Active right now" / "Open bets" / "What NOT to work on" |
| `feedback` | Path matches `raw/feedback_*.md` |
| `project` | Path matches `raw/project_*.md` |
| `reference` | Path matches `raw/reference_*.md` |
| `log` | Filename is `main_agent_memory_logs.md` OR has `### YYYY-MM-DD` headers with bullet lists |
| `marketing-master` | Path matches `marketing/*/[name]-marketing.md` AND file has sections: Positioning, Voice, Anti-patterns, Approved Examples |

Output: shape detection table — one row per source file.

---

## Phase 3 — Unit extraction

Extract memory units from each source. Unit boundary by shape:

**philosophy shape:**
- One bolded principle + following prose until next bold = one unit
- Section "Li's Takes" — each bolded topic + stance = one unit

**priorities shape:**
- "Active right now" — one unit per bullet
- "Open bets" — one unit per bullet
- "What NOT to work on" — one unit per bullet
- "Recently shipped" — extract but tag as `candidate-drop:action-log`
- "Scheduled tasks" — one unit per bullet

**feedback shape:**
- Whole file = one unit (already atomic)
- Extract: frontmatter `name` as unit ID, "How to apply" block as behavioral sentence

**project shape:**
- Default: whole file = one unit
- Exception: if filename is `project_memorymarket_v3.md` — split at sub-section level (each H2/H3 = one unit)

**reference shape:**
- Whole file = one unit

**log shape:**
- Each bullet under a `### YYYY-MM-DD` header = one unit
- Pre-classify each bullet before extraction:
  - Starts with "Li:" or "Li said" or direct quote → keep, tag `candidate-goal-or-directive`
  - Contains "decided:", "locked:", "domain is", "going with" → keep, tag `candidate-claim-or-goal`
  - Contains correction keywords ("corrected:", "never use", "stop doing", "don't") → keep, tag `candidate-directive`, run de-dup check
  - Contains action narration ("ran /", "committed ", "published ", "sent ", "deployed ") → tag `candidate-drop:action-log`
  - Ambiguous → keep, tag `candidate-ambiguous`

**marketing-master shape:**
- Section "Positioning" / "Core Story" / "Product Description" → one unit per section, tag `candidate-claim`
- Section "Voice rules" / "Anti-patterns" / "Vocabulary" → one unit per bullet, tag `candidate-directive`
- Section "Marketing Philosophy" → one unit per bullet, tag `candidate-goal`
- Section "Revision Checklist" → one unit per item, tag `candidate-directive`
- Section "Approved Examples" → one unit per example, tag `candidate-demonstration`

### De-duplication check (for log candidate-directive units)

Before keeping a log-extracted directive, check against all `raw/feedback_*.md` files:
- Extract the behavioral sentence from the candidate
- For each feedback file, extract the behavioral sentence from the "How to apply" block
- If key nouns + verbs overlap >80%: mark unit as `DUPLICATE — skip (canonical: feedback/[filename])`
- If no match: keep

### Output: draft unit list

Print a numbered list of all extracted units:

```
[N] SOURCE: [filename] | SHAPE: [shape] | CANDIDATE: [action-log / goal / claim / directive / demonstration / ambiguous] | DEDUP: [skip / keep] | TEXT: [first 80 chars of unit]
```

Action-log candidates go at the bottom, clearly separated.

**PAUSE HERE. Show the user this list and ask:**

> Review the unit list above. Mark any units to drop or reclassify before classification runs.
> Reply with:
> - DROP [N] — to drop a unit
> - RECLASSIFY [N] as [type] — to override the candidate type
> - OK — to proceed with no changes

Do not proceed to Phase 4 until the user replies.

---

## Phase 4 — Primitive classification + capability routing

For each unit not tagged `action-log` and not dropped by user:

### Step 1 — Assign primitive type

| Candidate tag | Default type |
|---|---|
| `candidate-goal` | `goal` |
| `candidate-claim` | `claim` |
| `candidate-directive` | `directive` |
| `candidate-demonstration` | `demonstration` |
| `candidate-goal-or-directive` | Propose a split: (1) extract goal form using "Default [stance]: [behavior]" or "Optimize [X] over [Y]"; (2) extract directive form using "In [context], always/never [behavior]"; (3) present both drafts and ask: "Accept split? (yes / merge as goal / merge as directive)" |
| `candidate-claim-or-goal` | If assertion about external state → `claim`; if optimization target or priority → `goal` |
| `candidate-ambiguous` | Flag for human review — DO NOT force-route |

### Step 2 — Route to capability file

Priority order (first match wins):

1. Contains `credential / API key / token / n8n / Resend / PostHog / .env / email address / deploy` → `ops-tools.md`
2. Contains `em dash / voice / tone / style / format / tagline / draft / slop / banned / pattern / vocabulary / phrasing / sentence-pattern` → `copy-voice.md`
2.5. Contains `theme / color / palette / visual / brand / design / font / background` → `copy-voice.md` (add `subtype: visual-brand` to frontmatter)
3. Contains `angle / framing / story / launch / post / CTA / channel / lead with / closed loop / closed-loop / content strategy / narrative` → `content-strategy.md`
4. Is a factual assertion about a product (claim primitive) → `product-context.md`
5. Is a goal, priority, or operating principle → `operating-principles.md`
6. Is an approved artifact → `demonstrations.md`

When still ambiguous after keyword matching: flag for human review. Surface as:
```
⚠️ AMBIGUOUS ROUTING: [unit N] — matched keywords [X, Y] in multiple files. Which capability file should this go to?
```

### Step 3 — Format as AMP primitive

**goal:**
```markdown
---
type: goal
force: should
scope: [org|project|user]
stability: [permanent|seasonal|tactical]
source: self
---

[Sentence in one of: "In [context], the goal is to [outcome]." / "Optimize [X] over [Y]." / "Default [stance]: [behavior]."]

**Why:** [source context, 1 sentence]
```

**claim:**
```markdown
---
type: claim
stability: [permanent|tactical]
source: self
---

[Subject] is / has [assertion — thesis sentence first]

**Why:** [source context, 1 sentence if relevant]
```

**directive:**
```markdown
---
type: directive
force: [must|should|may]
scope: [org|project|session]
stability: [permanent|seasonal|tactical]
source: self
---

In [context], [always|never] [behavior].
— OR —
When [condition], prefer [behavior] over [alternative].

**Why:** [reason, 1 sentence]
```

**demonstration:**
```markdown
---
type: demonstration
valence: [positive|negative|mixed]
illustrates: [directive-id]  # optional
source: self
---

[Full artifact body]
```

### Action-log units
Drop silently. Exception: if the action-log bullet contains an embedded Li-quote (sentence starting "Li:"), extract the quote as a new unit before dropping the narration.

---

## Phase 5 — Draft pack assembly

Create directory structure:
```
[out-dir]/
  manifest.json
  agents.md
  memory/
    copy-voice.md
    content-strategy.md
    product-context.md
    ops-tools.md
    operating-principles.md
    demonstrations.md    ← only if demonstration units exist
```

Write each capability file as a markdown document with:
- YAML frontmatter: `type: cluster`, `applies_to: [topic description]`, `primitive_counts: {directive: N, claim: N, goal: N, demonstration: N}`
- One primitive block per extracted unit, separated by `---`

**agents.md format:**
```markdown
# AMP Routing — [pack-name]

## Always load
- operating-principles.md — active priorities, operating principles, open bets

## Route by task type

| If the task involves... | Load |
|---|---|
| Writing anything (copy, posts, scripts, headlines) | copy-voice.md |
| Content strategy (angle, framing, channel, launch copy) | content-strategy.md |
| Product facts (positioning, pricing, features) | product-context.md |
| Ops or automation (email, credentials, tools, workflows) | ops-tools.md |
| Reviewing approved examples or tone matching | demonstrations.md |
```

**manifest.json format:**
```json
{
  "name": "[pack-name]",
  "version": "0.1.0",
  "layout": "semantic-cluster",
  "created": "[ISO date]",
  "sources": ["[list of source files]"],
  "capability_files": ["copy-voice.md", "content-strategy.md", "product-context.md", "ops-tools.md", "operating-principles.md"],
  "agents_file": "agents.md",
  "primitive_counts": {
    "goal": N,
    "claim": N,
    "directive": N,
    "demonstration": N,
    "dropped_action_log": N,
    "dropped_duplicate": N
  }
}
```

---

## Phase 6 — Validation

Check every drafted primitive:

- `goal`: body contains a sentence matching at least one goal pattern
- `claim`: first 3 lines of body contain a thesis-pattern assertion
- `directive`: body contains `(context, force, behavior)` or `(condition, preferred, alternative)` triple
- `demonstration`: has `valence` frontmatter
- No primitive contains credential values (scan for patterns: `sk-`, `re_`, `phc_`, anything after `=` in key=value lines that looks like a token)
- No primitive is pure action-log content (check: does the unit contain a verb + object without a behavioral context?)

Validation report format:
```
PASS: [N] primitives valid
FAIL: [N] primitives failed validation
  - [unit ID] — REASON: [specific failure]
WARN: [N] ambiguous units still unresolved — awaiting human review
```

Failed primitives are NOT written to the pack. They appear in the report only.

---

## Phase 7 — Pack output

After human approves the draft (or if no validation failures):

1. Write all capability files to `[out-dir]/memory/`
2. Write `agents.md` to `[out-dir]/`
3. Write `manifest.json` to `[out-dir]/`
4. Print summary:

```
Pack written to: [out-dir]
  [N] total primitives
  [N] goals → operating-principles.md
  [N] directives → copy-voice.md ([N]), content-strategy.md ([N]), ops-tools.md ([N])
  [N] claims → product-context.md ([N]), ops-tools.md ([N])
  [N] demonstrations → demonstrations.md
  [N] dropped (action-log)
  [N] dropped (duplicate)
  [N] flagged for review
```

---

## Constraints

- Does NOT write to `~/.claude/projects/*/memory/` — pack output goes to `workspace/amp-packs/` only
- Does NOT sign the manifest — signing is Cycle 5
- Does NOT upload to MemoryMarket — host integration layer is Cycle 4
- Does NOT make final routing decisions for ambiguous units — flags them
- Does NOT split composite source files automatically — flags them
- Does NOT include credentials in any output file
