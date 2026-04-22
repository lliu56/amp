#!/usr/bin/env node
const [nodeMajor] = process.versions.node.split(".").map(Number);
if (nodeMajor < 18) {
  console.error(`amp requires Node.js 18 or higher. You are running Node.js ${process.versions.node}.`);
  console.error("Upgrade at: https://nodejs.org");
  process.exit(1);
}

import { keygen } from "../commands/keygen.js";
import { sign } from "../commands/sign.js";
import { verify } from "../commands/verify.js";
import { install } from "../commands/install.js";
import { inspect } from "../commands/inspect.js";
import { uninstall } from "../commands/uninstall.js";
import { CliError } from "../errors/index.js";

const VERSION = "0.1.0";
const [, , cmd, ...args] = process.argv;

async function main(): Promise<void> {
  switch (cmd) {
    case "keygen": {
      const forceFlag = args.includes("--force");
      const outFlag = args.includes("--out") ? args[args.indexOf("--out") + 1] : undefined;
      keygen({ force: forceFlag, out: outFlag });
      break;
    }

    case "sign": {
      const packDir = args[0];
      if (!packDir || packDir.startsWith("--")) {
        console.error("Usage: amp sign <pack-dir> [--key <private-key-file>]");
        process.exit(1);
      }
      const keyFlag = args.includes("--key") ? args[args.indexOf("--key") + 1] : undefined;
      sign(packDir, { keyPath: keyFlag });
      break;
    }

    case "verify": {
      const packDir = args[0];
      if (!packDir || packDir.startsWith("--")) {
        console.error("Usage: amp verify <pack-dir> [--public-key <file|pem>]");
        process.exit(1);
      }
      const pubKeyFlag = args.includes("--public-key") ? args[args.indexOf("--public-key") + 1] : undefined;
      verify(packDir, { publicKey: pubKeyFlag });
      break;
    }

    case "install": {
      const scopeFlag = args.includes("--scope") ? args[args.indexOf("--scope") + 1] : undefined;
      const scope = scopeFlag === "user" ? "user" : "project";
      const agentFlag = args.includes("--agent") ? args[args.indexOf("--agent") + 1] : undefined;
      const fromPathFlag = args.includes("--from-path") ? args[args.indexOf("--from-path") + 1] : undefined;

      if (!fromPathFlag) {
        console.error("Usage: amp install --from-path <pack-dir> [--scope user] [--agent <name>]");
        console.error("\nNote: the open-source amp CLI installs from local paths only.");
        console.error("For registry installs, use a registry-specific CLI (e.g. mm from MemoryMarket).");
        process.exit(1);
      }
      await install({ scope, agent: agentFlag, fromPath: fromPathFlag });
      break;
    }

    case "inspect": {
      const slug = args[0];
      if (!slug) {
        console.error("Usage: amp inspect <slug> [--scope user]");
        process.exit(1);
      }
      const scopeFlag = args.includes("--scope") ? args[args.indexOf("--scope") + 1] : undefined;
      inspect(slug, { scope: scopeFlag === "user" ? "user" : "project" });
      break;
    }

    case "uninstall": {
      const slug = args[0];
      if (!slug) {
        console.error("Usage: amp uninstall <slug> [--scope user]");
        process.exit(1);
      }
      const scopeFlag = args.includes("--scope") ? args[args.indexOf("--scope") + 1] : undefined;
      await uninstall(slug, { scope: scopeFlag === "user" ? "user" : "project" });
      break;
    }

    case "--version":
    case "-v":
    case "version":
      console.log(VERSION);
      break;

    case "help":
    case "--help":
    case "-h":
    case undefined:
      printHelp();
      break;

    default:
      console.error(`Unknown command: ${cmd}\n`);
      printHelp();
      process.exit(1);
  }
}

function printHelp(): void {
  console.log(`
amp — Agent Memory Protocol CLI (v${VERSION})

Open-source reference implementation of AMP — the protocol for packaging,
signing, and installing AI agent memory packs.

Usage:
  amp keygen                       Generate an Ed25519 signing keypair
    --out <path>                   Write private key to custom path
    --force                        Overwrite existing key
  amp sign <pack-dir>              Sign an AMP pack with your private key
    --key <file>                   Use a specific private key file
  amp verify <pack-dir>            Verify a pack's signature
    --public-key <file|pem>        Public key to verify against (or set AMP_PUBLIC_KEY)
  amp install --from-path <dir>    Install a local AMP pack into the current project
    --scope user                   Install globally instead of per-project
    --agent <name>                 Target agent (claude-code|codex|cursor|windsurf)
  amp inspect <slug>               Show installed pack metadata
    --scope user                   Inspect a user-scoped install
  amp uninstall <slug>             Remove an installed pack
    --scope user                   Uninstall a user-scoped pack
  amp version                      Print version

Environment variables:
  AMP_PRIVATE_KEY                  Private key PEM (overrides --key file)
  AMP_PUBLIC_KEY                   Public key PEM (overrides --public-key flag)

Spec:    https://github.com/lliu56/amp/blob/main/spec/amp-v0.3-spec.md
Skill:   https://github.com/lliu56/amp/blob/main/skills/amp-capture/SKILL.md
License: MIT
`);
}

main().catch((err: unknown) => {
  if (err instanceof CliError) {
    console.error(`Error: ${err.message}`);
    process.exit(err.exitCode);
  }
  console.error("Unexpected error:", err);
  process.exit(1);
});
