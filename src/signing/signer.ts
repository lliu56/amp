/**
 * signer.ts — pack signing logic for AMP v0.2
 *
 * Signing payload (deterministic):
 *   JSON.stringify(manifest WITH signed:true, WITHOUT signature field,
 *                  keys sorted in PostgreSQL JSONB order)
 *   + "\n"
 *   + sha256 of every file in the pack (relative paths, sorted ASC)
 *     joined by "\n"
 *
 * JSONB key order: length ASC then lexicographic ASC for equal-length keys.
 * This matches the install-side payload (which reads manifest_json from the DB —
 * JSONB canonical — and calls JSON.stringify on the returned object).
 */

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

export interface AmpManifest {
  name: string;
  version: string;
  layout: string;
  capability_files?: string[];
  signed?: boolean;
  signature?: string;
  [key: string]: unknown;
}

/**
 * Sort object keys in PostgreSQL JSONB order: length ASC, then lexicographic ASC.
 * Recursive — nested objects are also sorted.
 */
export function jsonbSortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(jsonbSortKeys);
  if (value !== null && typeof value === "object") {
    const sorted: Record<string, unknown> = {};
    const keys = Object.keys(value as Record<string, unknown>).sort((a, b) =>
      a.length !== b.length ? a.length - b.length : a < b ? -1 : a > b ? 1 : 0
    );
    for (const k of keys) sorted[k] = jsonbSortKeys((value as Record<string, unknown>)[k]);
    return sorted;
  }
  return value;
}

/** Recursively list all files in a directory, returning relative paths sorted ASC. */
export function listPackFiles(packDir: string): string[] {
  const results: string[] = [];
  function walk(dir: string, base: string) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const rel = path.join(base, entry.name);
      const abs = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(abs, rel);
      } else {
        results.push(rel.replace(/\\/g, "/")); // normalise to forward slashes
      }
    }
  }
  walk(packDir, "");
  return results.sort();
}

/** Compute sha256 of a file, returned as hex string. */
export function sha256File(filePath: string): string {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

/**
 * Build the canonical signing payload for a pack directory.
 *
 * The manifest is serialised WITH "signed: true" but WITHOUT the "signature" field,
 * and with keys sorted in PostgreSQL JSONB order (length ASC, lex ASC).
 * This matches what install-side computes from the JSONB-stored manifest_json.
 */
export function buildSigningPayload(packDir: string): { payload: string; fileHashes: Record<string, string> } {
  const manifestPath = path.join(packDir, "manifest.json");
  const rawManifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8")) as AmpManifest;

  // Strip "signature", force "signed: true" so sign-side and verify-side agree
  // regardless of on-disk state at the time of the call.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { signature: _sig, ...rest } = rawManifest;
  const manifestForSigning = { ...rest, signed: true };

  // Sort keys JSONB-style so payload matches install-side verification
  const canonicalManifest = jsonbSortKeys(manifestForSigning);
  const manifestJson = JSON.stringify(canonicalManifest);

  const files = listPackFiles(packDir).filter((f) => f !== "manifest.json");
  const fileHashes: Record<string, string> = {};
  for (const rel of files) {
    fileHashes[rel] = sha256File(path.join(packDir, rel));
  }

  const sortedHashes = Object.keys(fileHashes)
    .sort()
    .map((k) => fileHashes[k]);

  const payload = [manifestJson, ...sortedHashes].join("\n");
  return { payload, fileHashes };
}

/**
 * Sign a pack directory using an Ed25519 private key PEM.
 * Updates manifest.json in-place with signed: true and signature fields.
 */
export function signPack(packDir: string, privateKeyPem: string): string {
  const { payload } = buildSigningPayload(packDir);

  const normalized = privateKeyPem.replace(/\\n/g, "\n");
  const privKey = crypto.createPrivateKey({ key: normalized, format: "pem" });
  const sigBuf = crypto.sign(null, Buffer.from(payload, "utf8"), privKey);
  const signature = sigBuf.toString("base64url");

  // Update manifest.json with signature
  const manifestPath = path.join(packDir, "manifest.json");
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8")) as AmpManifest;
  manifest.signed = true;
  manifest.signature = signature;
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), "utf-8");

  return signature;
}

/**
 * Verify a pack directory against a public key PEM.
 * Returns true if signature is valid, false otherwise.
 */
export function verifyPack(packDir: string, publicKeyPem: string): boolean {
  const manifestPath = path.join(packDir, "manifest.json");
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8")) as AmpManifest;

  if (!manifest.signature) return false;

  const { payload } = buildSigningPayload(packDir);

  try {
    const normalized = publicKeyPem.replace(/\\n/g, "\n");
    const pubKey = crypto.createPublicKey({ key: normalized, format: "pem" });
    const sigBuf = Buffer.from(manifest.signature, "base64url");
    return crypto.verify(null, Buffer.from(payload, "utf8"), pubKey, sigBuf);
  } catch {
    return false;
  }
}

/**
 * Generate an Ed25519 keypair.
 * Returns { privateKeyPem, publicKeyPem }
 */
export function generateKeyPair(): { privateKeyPem: string; publicKeyPem: string } {
  const { privateKey, publicKey } = crypto.generateKeyPairSync("ed25519", {
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
    publicKeyEncoding: { type: "spki", format: "pem" },
  });
  return { privateKeyPem: privateKey, publicKeyPem: publicKey };
}
