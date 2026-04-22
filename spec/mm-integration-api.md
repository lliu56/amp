# MemoryMarket Integration API — AMP v0.3

**Audience:** MemoryMarket product/engineering team wiring AMP into memorymarket.co
**Status:** locked 2026-04-21 (Cycle 6)

This document specifies what the registry API must provide for the CLI's `mm install @creator/slug` flow to work end-to-end with AMP v0.3 packs.

---

## Existing endpoints (already wired in CLI v0.2.1)

### POST /api/installs/create-token

Returns download info for a pack. The CLI uses this to get file URLs and verify the signature.

**Request:**
```json
{
  "pack_id": "uuid or null",
  "slug": "pack-slug",
  "scope": "project | user",
  "agent": "claude-code | codex | cursor | windsurf"
}
```

**Response (must include for AMP v0.3):**
```json
{
  "pack_id": "uuid",
  "slug": "arkzero",
  "title": "Arkzero Memory Pack",
  "version_id": "uuid",
  "signature": "<base64url Ed25519 signature>",
  "manifest": { /* full manifest.json object including signed:true and signature field */ },
  "files": [
    {
      "path": "manifest.json",
      "file_kind": "manifest",
      "download_url": "https://...",
      "sha256": "hex",
      "byte_size": 512,
      "preview_content": null,
      "is_required": true
    },
    {
      "path": "agents.md",
      "file_kind": "agents",
      "download_url": "https://...",
      "sha256": "hex",
      "byte_size": 800,
      "preview_content": null,
      "is_required": true
    },
    {
      "path": "memory/operating-principles.md",
      "file_kind": "capability",
      "download_url": "https://...",
      "sha256": "hex",
      "byte_size": 2400,
      "preview_content": null,
      "is_required": true
    }
    // ... one entry per file in the pack
  ],
  "activation_snippet": null,
  "scope": "project",
  "expires_in": 3600
}
```

**Critical for AMP v0.3:**
- `files[].path` must be the relative path from pack root (e.g. `"memory/copy-voice.md"`, not just `"copy-voice.md"`). The CLI uses this to reconstruct the directory tree under `.memorymarket/<slug>/`.
- `manifest` must include `signed: true` and `signature` fields — the CLI validates these after download.
- `bundle_url` (alternative to `files[]`) is not fully supported in AMP v0.3 CLI — the CLI writes the bundle as a file but does not extract it. Use `files[]` for all AMP packs.

---

### POST /api/installs/activate

Called after successful install. No change required for AMP v0.3 — existing contract works.

**Request:**
```json
{
  "pack_id": "uuid",
  "pack_version_id": "uuid",
  "agent": "claude-code",
  "install_scope": "project",
  "install_path": "/path/to/.memorymarket/slug",
  "installer_version": "0.2.1"
}
```

Note: `install_path` is now a directory path (`.memorymarket/<slug>/`), not a file path (`.memorymarket/<slug>.md`). Registry should store both formats during the v0.1→v0.2 transition.

---

### POST /api/installs/deactivate

Called on uninstall. No change required.

---

## New requirements for AMP v0.3

### 1. Pack validation on upload (server-side)

When a creator uploads a pack via `mm publish`, the registry must validate:

1. `manifest.layout === "semantic-cluster"`
2. `agents.md` present
3. All `capability_files` present under `memory/`
4. `signed === true` (registry packs must be signed)
5. Signature verifies against the creator's registered public key

Refuse with `400 Bad Request` + descriptive error if any gate fails.

### 2. Creator public key registration

Creators register their public key with MemoryMarket once. The registry stores it and uses it to verify pack signatures on upload and to include in the `create-token` response for buyer-side verification.

**Registration endpoint (new):**
```
POST /api/keys/register
Body: { "public_key_pem": "-----BEGIN PUBLIC KEY-----\n..." }
Response: { "key_id": "uuid", "fingerprint": "sha256:...", "registered_at": "ISO" }
```

**Key lookup (for CLI signature verification):**
The `create-token` response may include:
```json
"public_keys": [
  {
    "key": "-----BEGIN PUBLIC KEY-----\n...",
    "key_id": "uuid",
    "expires_at": null
  }
]
```
This lets the CLI verify without the buyer needing `MM_PUBLIC_KEY` set locally.

### 3. Pack file storage format

The registry must store pack files with their relative paths preserved (matching the AMP pack directory structure). When generating `files[]` for `create-token`, paths must be relative from pack root:

```
manifest.json
agents.md
memory/operating-principles.md
memory/copy-voice.md
memory/content-strategy.md
memory/product-context.md
memory/ops-tools.md
memory/demonstrations.md   (if present)
```

---

## Signing payload (for server-side verification)

The registry verifies creator signatures using the same payload the CLI generates:

```
payload = JSON.stringify(manifest_without_signed_signature_fields) + "\n" + sha256(file_1) + "\n" + ...
```

Files hashed: everything except `manifest.json`, sorted by relative path ascending.

**Reference implementation:** `packages/cli/src/signing/signer.ts::buildSigningPayload()`

---

## Pack discovery endpoint (existing, no change needed)

```
GET /api/packs/<slug>?by_slug=true
Response: { "pack": { "id": "uuid", "slug": "...", "title": "..." } }
```

---

## CLI version compatibility matrix

| CLI version | Install layout | Validation | Signing |
|---|---|---|---|
| 0.1.x | single `.memorymarket/<slug>.md` | none | none |
| 0.2.0 | `.memorymarket/<slug>/` subtree | gates 1-5 | gate 6 on registry path |
| 0.2.1 | same | same | + keygen/sign/verify commands |

The registry should accept `installer_version` from the activate endpoint to track which CLI version buyers are using.

---

## What the product team does NOT need to do

- Implement the managed-block write — that's 100% in the CLI (`hostRewrite/index.ts`)
- Implement the pack validation spec — the CLI validates after download
- Handle routing or agents.md parsing — the CLI reads and inlines it
- Generate Ed25519 keypairs for creators — creators run `mm keygen` locally
