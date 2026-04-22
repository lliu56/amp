# amp — Agent Memory Protocol

Open-source reference implementation of **AMP**, the protocol for packaging, signing, and installing AI agent memory between people.

One install. One signed file. Your agent inherits someone else's operating context on the next prompt.

---

## Quickstart

```bash
# 1. Install (requires Node 18+)
npm install -g @lliu56/amp

# 2. Generate your signing keypair (once per machine)
amp keygen

# 3. Sign a pack directory you've created
amp sign ./my-pack

# 4. Verify a pack someone else signed
amp verify ./my-pack --public-key ~/.amp/keys/signing.pub

# 5. Install a local pack into your project's agent
amp install --from-path ./my-pack

# 6. (Optional) Integrate the installed pack into your Karpathy wiki
#    Run this as a skill from inside Claude Code / Codex / any host agent:
#    /amp-unpack
```

That's it. Your agent's rules file (`CLAUDE.md`, `AGENTS.md`, `.cursor/rules/`, or `.windsurfrules`) now includes the pack's routing block. On the next prompt, the agent uses it.

The optional `/amp-unpack` skill (shipped in `skills/amp-unpack/SKILL.md`) runs from inside a host agent and merges the installed pack into a Karpathy-style wiki at `knowledge-base/wiki/`. If you don't have one, the skill offers to scaffold one. The CLI install alone is enough without this step.

---

## What AMP is

Every AI agent has three layers:

| Layer | Comes from | Yours? |
|-------|-----------|--------|
| Model | Anthropic, OpenAI, Google | No |
| Skills | Open protocols, bundled with every agent | No |
| **Memory** | **You, over months of use** | **Yes** |

Memory is the only part that's actually yours, and the only part worth transferring between people. Before AMP, there was no standard way to do that. Everyone's memory file lived on one laptop, in one vendor's folder, with no signing, no verification, no taxonomy, no install primitive.

AMP defines:

- **4 primitives** that every line in a memory file falls into — `goal`, `claim`, `directive`, `demonstration`
- **Pack format** — a directory of signed markdown with a manifest
- **Signing** — Ed25519 signatures so tampering breaks verification
- **Install primitive** — drop a pack into any compatible coding agent's memory without overwriting what's already there

AMP is the protocol. The CLI in this repo is the open-source reference implementation. Registries (like [MemoryMarket](https://memorymarket.co)) are built on top.

---

## Install

```bash
npm install -g @lliu56/amp
```

Requires Node.js 18 or higher.

---

## Commands

### `amp keygen`
Generate an Ed25519 signing keypair. Default location: `~/.amp/keys/signing.key` + `~/.amp/keys/signing.pub`.

```bash
amp keygen
amp keygen --out ./my-key.key        # Custom path
amp keygen --force                   # Overwrite existing key
```

### `amp sign <pack-dir>`
Sign an AMP pack with your private key. Writes `signed: true` and `signature` into the pack's `manifest.json`.

```bash
amp sign ./my-pack
amp sign ./my-pack --key ./my-key.key
AMP_PRIVATE_KEY="$(cat ~/.amp/keys/signing.key)" amp sign ./my-pack
```

### `amp verify <pack-dir>`
Verify a pack's signature against a public key. Exits 0 if VALID, 1 if INVALID or tampered.

```bash
amp verify ./my-pack --public-key ~/.amp/keys/signing.pub
amp verify ./my-pack --public-key "-----BEGIN PUBLIC KEY-----\n..."
AMP_PUBLIC_KEY="$(cat ~/.amp/keys/signing.pub)" amp verify ./my-pack
```

### `amp install --from-path <pack-dir>`
Install a local AMP pack into the current project's coding agent.

```bash
amp install --from-path ./my-pack
amp install --from-path ./my-pack --scope user               # Install globally for your user
amp install --from-path ./my-pack --agent claude-code        # Target specific agent
```

Supported agents: `claude-code`, `codex`, `cursor`, `windsurf`. Auto-detected from project markers (`CLAUDE.md`, `AGENTS.md`, `.cursor/`, `.windsurfrules`) if `--agent` isn't passed.

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

---

## Pack format

An AMP pack is a directory with this structure:

```
my-pack/
  manifest.json         # required — name, layout, signed, signature, capability_files
  agents.md             # required — routing/activation file inlined into the host agent
  memory/
    <capability>.md     # one file per semantic capability (e.g. copy-voice.md)
    <capability>.md
```

Every rule inside a capability file is written as a short sentence typed by linguistic act:

| Primitive | Example |
|-----------|---------|
| `goal` | "This pack helps the agent review payment systems with Stripe-scale discipline." |
| `claim` | "Payment flows with more than 2 redirects lose ~18% conversion." |
| `directive` | "In any review of a checkout flow, always check for client-side validation bypass." |
| `demonstration` | "Example — when the function is named `validateCard`, assume it runs on the client unless the file is under `/api/`." |

Full spec: [`spec/amp-v0.3-spec.md`](spec/amp-v0.3-spec.md).

---

## The 4 primitives (why these four)

AMP's taxonomy is first-principled — every memory line is doing one of four things linguistically. No borrowed categories (rules, persona, facts, procedures) that overlap and break registries.

- **goal** — what the agent should intend
- **claim** — what is asserted to be true
- **directive** — what the agent should do
- **demonstration** — how it looks in practice

Tested on 79 real memory files across 9 locations during the design cycles. 0% unclassifiable.

---

## Skills

AMP ships two Claude Code skills for the ends of the flow that require judgment:

- **[`/amp-capture`](skills/amp-capture/SKILL.md)** — distills a raw memory folder or Karpathy-style wiki into a valid AMP pack. Drop the skill into your `.claude/skills/` directory, run `/amp-capture`, point it at your source files, and it produces a signed-ready pack.
- **[`/amp-unpack`](skills/amp-unpack/SKILL.md)** — after `amp install`, integrates the installed pack into your Karpathy wiki at `knowledge-base/wiki/`. Scaffolds one if you don't have it. Adds wikilinks, updates the index, logs the integration. Idempotent.

The flow is symmetric: `/amp-capture` takes a wiki → pack, `/amp-unpack` takes a pack → wiki. The CLI commands (`sign`, `verify`, `install`) handle the deterministic plumbing in between.

---

## Run your own registry

AMP is registry-agnostic. Any server that implements the integration contract can host, verify, and serve packs. The spec is at [`spec/mm-integration-api.md`](spec/mm-integration-api.md).

The default registry most people will use is [MemoryMarket](https://memorymarket.co), which adds:

- A public key registry with GitHub + Stripe identity binding
- Server-side re-scanning and revocation
- Discovery, browse, and creator payouts

MemoryMarket is one registry. You can run your own.

---

## Environment variables

| Variable | Purpose |
|----------|---------|
| `AMP_PRIVATE_KEY` | Private key PEM string — overrides `--key` flag in `sign` |
| `AMP_PUBLIC_KEY` | Public key PEM string — overrides `--public-key` flag in `verify` |

---

## Development

```bash
git clone https://github.com/lliu56/amp.git
cd amp
npm install
npm run build
node dist/bin/amp.js --help
```

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). PRs welcome. Releases go through a maintainer-tagged workflow.

---

## License

MIT — see [LICENSE](LICENSE).

---

## Links

- **Spec:** [`spec/amp-v0.3-spec.md`](spec/amp-v0.3-spec.md)
- **Distillation skill:** [`skills/amp-capture/SKILL.md`](skills/amp-capture/SKILL.md)
- **Registry API contract:** [`spec/mm-integration-api.md`](spec/mm-integration-api.md)
- **Default registry:** [memorymarket.co](https://memorymarket.co)
- **Issues:** [github.com/lliu56/amp/issues](https://github.com/lliu56/amp/issues)
