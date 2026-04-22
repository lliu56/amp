import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { signPack } from "../signing/signer.js";
import { CliError } from "../errors/index.js";

const DEFAULT_KEY_PATH = path.join(os.homedir(), ".amp", "keys", "signing.key");

interface SignOptions {
  keyPath?: string;   // path to private key PEM file (default: ~/.amp/keys/signing.key)
}

export function sign(packDir: string, options: SignOptions = {}): void {
  const resolvedPackDir = path.resolve(process.cwd(), packDir);

  if (!fs.existsSync(resolvedPackDir) || !fs.statSync(resolvedPackDir).isDirectory()) {
    throw new CliError(`'${packDir}' is not a valid directory`, "INVALID_PATH");
  }

  const manifestPath = path.join(resolvedPackDir, "manifest.json");
  if (!fs.existsSync(manifestPath)) {
    throw new CliError("Missing manifest.json — is this an AMP pack directory?", "INVALID_PACK");
  }

  // Load private key: env var takes precedence over file
  let privateKeyPem: string;
  if (process.env.AMP_PRIVATE_KEY) {
    privateKeyPem = process.env.AMP_PRIVATE_KEY;
  } else {
    const keyPath = options.keyPath ?? DEFAULT_KEY_PATH;
    if (!fs.existsSync(keyPath)) {
      throw new CliError(
        `No private key found. Set AMP_PRIVATE_KEY or run 'amp keygen' first.\n` +
        `Expected: ${keyPath}`,
        "NO_KEY"
      );
    }
    privateKeyPem = fs.readFileSync(keyPath, "utf-8");
  }

  console.log(`Signing pack at ${resolvedPackDir}...`);

  const signature = signPack(resolvedPackDir, privateKeyPem);

  console.log(`\nSigned. Signature written to manifest.json.`);
  console.log(`Signature (base64url): ${signature.slice(0, 32)}...`);
  console.log(`\nShare your public key so others can verify with: amp verify <pack-dir> --public-key <key>`);
}
