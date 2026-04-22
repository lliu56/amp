import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { generateKeyPair } from "../signing/signer.js";
import { CliError } from "../errors/index.js";

const DEFAULT_KEY_DIR = path.join(os.homedir(), ".amp", "keys");
const DEFAULT_KEY_PATH = path.join(DEFAULT_KEY_DIR, "signing.key");
const DEFAULT_PUBKEY_PATH = path.join(DEFAULT_KEY_DIR, "signing.pub");

interface KeygenOptions {
  out?: string;       // path to write private key (default: ~/.amp/keys/signing.key)
  force?: boolean;    // overwrite if exists
}

export function keygen(options: KeygenOptions = {}): void {
  const keyPath = options.out ?? DEFAULT_KEY_PATH;
  const pubKeyPath = keyPath.replace(/\.key$/, ".pub");
  const keyDir = path.dirname(keyPath);

  if (fs.existsSync(keyPath) && !options.force) {
    throw new CliError(
      `Key already exists at ${keyPath}. Use --force to overwrite.`,
      "KEY_EXISTS"
    );
  }

  fs.mkdirSync(keyDir, { recursive: true });
  const { privateKeyPem, publicKeyPem } = generateKeyPair();

  // Write private key with owner-read-only permissions
  fs.writeFileSync(keyPath, privateKeyPem, { encoding: "utf-8", mode: 0o600 });
  fs.writeFileSync(pubKeyPath, publicKeyPem, { encoding: "utf-8", mode: 0o644 });

  console.log(`\nEd25519 keypair generated.`);
  console.log(`\nPrivate key: ${keyPath}`);
  console.log(`Public key:  ${pubKeyPath}`);
  console.log(`\nPublic key (set as AMP_PUBLIC_KEY for verification):\n`);
  console.log(publicKeyPem);
  console.log(`\nIMPORTANT: Keep the private key secret. Back it up securely.`);
  console.log(`Set AMP_PRIVATE_KEY=$(cat ${keyPath}) to use it for signing.`);
}
