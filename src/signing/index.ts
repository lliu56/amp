import { createPublicKey, verify } from "node:crypto";
import { SignatureError } from "../errors/index.js";

export function verifyBundleSignature(
  payload: string,
  signature: string,
  publicKeyPem: string
): boolean {
  try {
    const normalized = publicKeyPem.replace(/\\n/g, "\n");
    const pubKey = createPublicKey({ key: normalized, format: "pem" });
    // Server signs with Ed25519 (sign(null, payload, privKey)) → base64url encoded
    const sigBuf = Buffer.from(signature, "base64url");
    const payloadBuf = Buffer.from(payload, "utf8");
    return verify(null, payloadBuf, pubKey, sigBuf);
  } catch {
    return false;
  }
}

export function verifyBundleOrThrow(
  payload: string,
  signature: string,
  publicKeys: Array<{ key: string; expires_at?: string }>
): void {
  const now = Date.now();

  for (const { key, expires_at } of publicKeys) {
    if (expires_at && new Date(expires_at).getTime() < now) continue;
    if (verifyBundleSignature(payload, signature, key)) return;
  }

  throw new SignatureError();
}
