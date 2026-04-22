import fs from "node:fs";
import path from "node:path";
import { verifyPack, buildSigningPayload } from "../signing/signer.js";
import { CliError } from "../errors/index.js";

interface VerifyOptions {
  publicKey?: string;   // path to public key PEM file OR literal PEM string
}

export function verify(packDir: string, options: VerifyOptions = {}): void {
  const resolvedPackDir = path.resolve(process.cwd(), packDir);

  if (!fs.existsSync(resolvedPackDir) || !fs.statSync(resolvedPackDir).isDirectory()) {
    throw new CliError(`'${packDir}' is not a valid directory`, "INVALID_PATH");
  }

  const manifestPath = path.join(resolvedPackDir, "manifest.json");
  if (!fs.existsSync(manifestPath)) {
    throw new CliError("Missing manifest.json — is this an AMP pack directory?", "INVALID_PACK");
  }

  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8")) as {
    signed?: boolean;
    signature?: string;
    name?: string;
    [key: string]: unknown;
  };

  if (!manifest.signed || !manifest.signature) {
    console.error(`Pack '${manifest.name ?? packDir}' is NOT signed.`);
    process.exit(1);
  }

  // Load public key: env var > --public-key flag > error
  let publicKeyPem: string;
  if (process.env.AMP_PUBLIC_KEY) {
    publicKeyPem = process.env.AMP_PUBLIC_KEY;
  } else if (options.publicKey) {
    // Accept either a file path or a literal PEM string
    if (fs.existsSync(options.publicKey)) {
      publicKeyPem = fs.readFileSync(options.publicKey, "utf-8");
    } else if (options.publicKey.includes("BEGIN")) {
      publicKeyPem = options.publicKey;
    } else {
      throw new CliError(
        `--public-key value is neither a valid file path nor a PEM string.`,
        "INVALID_KEY"
      );
    }
  } else {
    throw new CliError(
      "No public key provided. Set AMP_PUBLIC_KEY or pass --public-key <file|pem>.",
      "NO_KEY"
    );
  }

  console.log(`Verifying pack at ${resolvedPackDir}...`);

  const { payload, fileHashes } = buildSigningPayload(resolvedPackDir);
  const fileCount = Object.keys(fileHashes).length;

  const valid = verifyPack(resolvedPackDir, publicKeyPem);

  if (valid) {
    console.log(`\n✓ Signature VALID`);
    console.log(`  Pack: ${manifest.name ?? packDir}`);
    console.log(`  Files covered: ${fileCount}`);
    console.log(`  Payload hash: ${Buffer.from(payload).slice(0, 32).toString("hex")}...`);
    process.exit(0);
  } else {
    console.error(`\n✗ Signature INVALID`);
    console.error(`  Pack: ${manifest.name ?? packDir}`);
    console.error(`  The pack may have been tampered with, or the wrong public key was used.`);
    process.exit(1);
  }
}
