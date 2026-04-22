# Contributing to amp

Thanks for considering a contribution. AMP aims to be a stable, widely-adoptable open protocol for AI agent memory transfer. That means changes land carefully.

## How contributions land

1. **Fork** the repo on GitHub
2. Make your changes in a branch on your fork
3. Open a **pull request** against `main`
4. A maintainer reviews
5. On approval, the PR is squash-merged into `main`
6. A maintainer cuts a release when appropriate — `amp` is published to npm from the release tag

Contributors never publish to npm directly. Only maintainers can tag releases.

## What we're looking for

- Bug fixes (with a repro case if possible)
- Documentation improvements
- Cross-platform compatibility fixes
- Additions to `skills/` that help creators produce better packs
- Feedback on the spec (open an issue tagged `spec`)

## What we're careful about

Changes to the protocol spec (`spec/amp-v0.3-spec.md`) and the pack format require more discussion. If you have an idea that changes how packs are structured, signed, or consumed, open an issue first — don't send a PR cold.

## Dev setup

```bash
git clone https://github.com/lliu56/amp.git
cd amp
npm install
npm run build
node dist/bin/amp.js --help
```

Run tests and type checks before opening a PR:

```bash
npm run typecheck
npm run build
```

## Style

- TypeScript, strict mode
- No frameworks, no runtime deps beyond `js-yaml` and `zod`
- Prefer boring code over clever code — the CLI must be auditable
- One command per file in `src/commands/`
- Shared modules in `src/signing/`, `src/paths/`, etc.

## Release process (maintainers only)

1. Update `version` in `package.json`
2. Update `VERSION` in `src/bin/amp.ts`
3. Merge to `main`
4. Tag: `git tag v0.1.1 && git push --tags`
5. GitHub Actions publishes to npm on tag push
