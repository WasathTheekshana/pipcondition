<div align="center">

<img src="src/app/icon.svg" alt="pipcondition Logo" width="96" height="96" />

# pipcondition

**Test Azure Pipeline conditions locally, before you burn another PR approval.**

[![CI/CD](https://github.com/WasathTheekshana/pipcondition/actions/workflows/ci.yaml/badge.svg)](https://github.com/WasathTheekshana/pipcondition/actions/workflows/ci.yaml)
&nbsp;
[![Test](https://github.com/WasathTheekshana/pipcondition/actions/workflows/test.yaml/badge.svg)](https://github.com/WasathTheekshana/pipcondition/actions/workflows/test.yaml)
&nbsp;
<a href="https://pipcondition.vercel.app"><img src="https://img.shields.io/badge/Live%20Demo-pipcondition.vercel.app-2563eb?style=flat-square&labelColor=171717" alt="Live Demo" /></a>
&nbsp;
<img src="https://img.shields.io/badge/License-MIT-2563eb?style=flat-square&labelColor=171717" alt="MIT License" />

</div>

---

pipcondition is an open-source simulator for Azure Pipelines YAML `condition:` expressions and `dependsOn` graphs. Paste or drop a real `azure-pipelines.yml` (with its referenced templates), assign mock outcomes to stages/jobs/steps, and see exactly what would run, skip, or fail - without pushing a real change through Azure DevOps and collecting approvals just to find out whether a condition tweak actually works.

Nothing executes. It's a dry-run evaluator: parse the YAML, build the dependency graph, run Azure's actual expression engine against the state you give it, and show you the result.

---

## Features

- **Full expression engine** - `and`/`or`/`not`/`xor`, `eq`/`ne`/`gt`/`ge`/`lt`/`le` with Azure's exact (and sometimes surprising) type-coercion rules, `succeeded()`/`failed()`/`always()`/`canceled()`/`succeededOrFailed()`, `contains`/`startsWith`/`endsWith`/`join`/`format`/`coalesce`/`length`/`in`/`notIn`/`containsValue`/`counter`, and full `variables`/`parameters`/`dependencies`/`stageDependencies` resolution
- **YAML/template resolver** - `${{ if/elseif/else/each/insert }}` compile-time expansion, typed `parameters:` with `values:` allow-lists, `template:` references (steps/jobs/stages level, cross-file, cycle-detected), and `extends:`
- **DAG simulation engine** - builds the real stage → job → step graph respecting Azure's asymmetric defaults (stages default to sequential, jobs default to parallel), evaluates every condition in topological order, rolls up results respecting `continueOnError`, and propagates `dependencies.*.outputs` / `stageDependencies.*.outputs` across stages
- **Runtime parameters & "stages to run"** - render the same boolean/choice/string controls Azure's own "Run pipeline" dialog shows, plus checkboxes to deselect stages and see the skip cascade, before you ever open a real PR
- **Multi-file import** - drag and drop a whole pipeline repo (entry file + `templates/*.yml`), pick which file is the entry point, and jump straight to the file behind any diagnostic
- **Condition breakdown** - click any stage/job/step to see its evaluated expression tree, with every sub-result highlighted
- **Azure DevOps PAT/REST API import** - _planned_: fetch a pipeline's real YAML directly from your org (see [SECURITY.md](SECURITY.md) for how the token is handled)

---

## Tech Stack

| | |
|---|---|
| Framework | [Next.js 16](https://nextjs.org) (App Router, Turbopack) |
| Language | TypeScript |
| Styling | [Tailwind CSS v4](https://tailwindcss.com) |
| State | [Zustand](https://zustand-demo.pmnd.rs) + Immer |
| YAML parsing | [`yaml`](https://eemeli.org/yaml/) |
| Stage/job graph | [React Flow](https://reactflow.dev) + [dagre](https://github.com/dagrejs/dagre) |
| Code editor | [CodeMirror 6](https://codemirror.net) |
| Icons | [Fluent UI System Icons](https://github.com/microsoft/fluentui-system-icons) |
| Testing | [Vitest](https://vitest.dev) |
| Package manager | Yarn 4 (pinned via Corepack) |
| Deployment | [Vercel](https://vercel.com) |

---

## Getting Started

### Prerequisites

- Node.js 24+
- Corepack (ships with Node - run `corepack enable` once)

### Run locally

```bash
git clone https://github.com/WasathTheekshana/pipcondition.git
cd pipcondition
corepack enable
yarn install
yarn dev
```

Open [http://localhost:3000](http://localhost:3000).

### Build

```bash
yarn build
yarn start
```

No environment variables are needed for local YAML simulation. The app runs entirely client-side until you use the (planned) Azure DevOps API import.

### Test

```bash
yarn test         # run once
yarn test:watch   # watch mode
```

159 tests cover the expression engine, the YAML/template resolver, and the DAG simulation engine - the three layers most likely to silently produce a wrong answer if broken.

---

## Self Hosting

**One-click Vercel deploy**

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/WasathTheekshana/pipcondition)

**Manual**

```bash
yarn build
yarn start   # runs on port 3000
```

---

## Project Structure

```
src/
├── app/
│   ├── page.tsx           # Main simulator view
│   └── api/ado/           # Azure DevOps PAT proxy (planned)
├── components/
│   ├── chrome/             # App shell, top nav, logo
│   ├── import/              # YAML editor, drag-drop, file tree
│   ├── mock-config/         # Run parameters, stage selector
│   └── run-view/             # Stage/job graph, condition breakdown, inspector
├── lib/
│   ├── expr/                # Condition/expression engine
│   ├── template/             # YAML parsing + ${{ }} template resolution
│   └── dag/                  # Stage/job/step graph + run simulation
└── store/                  # Zustand stores tying the engine to the UI
```

---

## CI / CD

Two workflows run on GitHub Actions:

| Workflow | Trigger | Steps |
|----------|---------|-------|
| **CI/CD** | Push and PR to `main`, or manual | Lint → Type check → Build → Deploy to Vercel. The `Test` job is skipped by default on push/PR - dispatch the workflow manually with the `run_tests` checkbox ticked to include it. |
| **Test** | Manual only | Runs the full Vitest suite on demand, independent of CI/CD. |

---

## Contributing

Contributions are welcome. Open an issue before submitting a large PR - see [CONTRIBUTING.md](CONTRIBUTING.md) for the full guide.

```bash
git checkout -b feat/your-feature
# make changes
git commit -m "feat: describe your change"
git push origin feat/your-feature
# open a pull request
```

---

## License

MIT - see [LICENSE](LICENSE) for details.

---

<div align="center">
  <sub>Built by <a href="https://github.com/WasathTheekshana">Wasath Theekshana</a></sub>
  <br /><br />
  <a href="https://buymeacoffee.com/wasath">
    <img src="https://img.shields.io/badge/Buy%20Me%20a%20Coffee-ffdd00?style=for-the-badge&logo=buy-me-a-coffee&logoColor=black" alt="Buy Me A Coffee" />
  </a>
  &nbsp;
  <a href="https://ko-fi.com/wasath">
    <img src="https://img.shields.io/badge/Ko--fi-FF5E5B?style=for-the-badge&logo=ko-fi&logoColor=white" alt="Ko-fi" />
  </a>
</div>
