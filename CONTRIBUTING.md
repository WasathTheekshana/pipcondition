# Contributing to pipcondition

Thank you for taking the time to contribute! Here is how to get started.

## Development setup

```bash
git clone https://github.com/WasathTheekshana/pipcondition.git
cd pipcondition
corepack enable
yarn install
yarn dev
```

Open [http://localhost:3000](http://localhost:3000).

## Workflow

1. Fork the repo and create a branch from `main`:

   ```bash
   git checkout -b feat/your-feature-name
   ```

2. Make your changes and verify everything passes:

   ```bash
   yarn build
   yarn lint
   yarn tsc --noEmit
   yarn test
   ```

3. Open a pull request against `main` and fill in the template.

## Guidelines

- Keep pull requests focused - one feature or fix per PR.
- Write clear commit messages using conventional prefixes: `feat:`, `fix:`, `chore:`, `docs:`, `test:`.
- Do not introduce new dependencies without opening a discussion issue first.
- Changes to `src/lib/expr` (the condition/expression engine) must stay faithful to Azure Pipelines' actual documented semantics - cite the relevant [Microsoft Learn](https://learn.microsoft.com/en-us/azure/devops/pipelines/process/expressions) section in the PR description if you're changing evaluation behavior, and add a test.
- Every engine change (`src/lib/expr`, `src/lib/template`, `src/lib/dag`) needs a corresponding Vitest test - this is the highest-risk correctness surface in the app.
- Local-first by default: pipeline YAML pasted or dropped in the browser must never leave the client. The only exception is the Azure DevOps PAT/REST API proxy (`src/app/api/ado/*`), which is server-only by design - see [SECURITY.md](SECURITY.md).
- Use `yarn` exclusively (pinned via corepack, see `packageManager` in `package.json`) - do not commit a `package-lock.json` or `pnpm-lock.yaml`.

## What to work on

Check the [open issues](https://github.com/WasathTheekshana/pipcondition/issues) for things labeled `good first issue` or `help wanted`.

## Reporting bugs

Open an issue using the **Bug report** template. Include the minimal pipeline YAML that reproduces the issue, your OS, and browser version.

## Suggesting features

Open an issue using the **Feature request** template. Describe the use case, not just the solution.

## Code of conduct

This project follows the [Contributor Covenant Code of Conduct](./CODE_OF_CONDUCT.md). Be kind.
