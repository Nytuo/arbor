
<h1 align="center">
  <a href="https://github.com/Nytuo/confero">
    <img src="public/favicon.png" alt="Logo" width="auto" height="100">
  </a>
</h1>
<div align="center">
	<h2>Arbor</h2>
	<p>A small, local-first family tree editor with GEDCOM & JSON import/export.</p>
</div>

---

## Table of Contents

- [Arbor](#Arbor)
  - [Table of Contents](#table-of-contents)
  - [About](#about)
  - [Project Structure](#project-structure)
  - [Built With](#built-with)
  - [Getting Started](#getting-started)
    - [Prerequisites](#prerequisites)
    - [Installation](#installation)
  - [Usage](#usage)
  - [Data \& Scripts](#data--scripts)
  - [Development](#development)
  - [Contributing](#contributing)
  - [Authors \& Contributors](#authors--contributors)
  - [License](#license)

---

## About

`Arbor` is a lightweight family tree editor built with Vite, React and TypeScript. It supports importing GEDCOM and JSON files, visualizing a simple tree, editing person nodes, and exporting the tree back to GEDCOM or JSON.

## Project Structure

- `src/` — React application source: components, store, types, and utilities.
- `data/` — sample GEDCOM files (e.g. [data/complex_2000.ged](data/complex_2000.ged)).
- `public/` — static assets (favicon, images).
- `scripts/` — small helper scripts (GEDCOM generation: `generate_gedcom.js`, `generate_gedcom.cjs`).
- `package.json`, `vite.config.ts`, `tsconfig.*.json` — project configuration.

## Built With

- Vite
- React
- TypeScript
- TailwindCSS (utility styles)

## Getting Started

### Prerequisites

- Node.js 18+ and npm or yarn

### Installation

Install dependencies:

```bash
npm install
```

Start the development server:

```bash
npm run dev
```

Build for production:

```bash
npm run build
```

Preview the production build:

```bash
npm run preview
```

## Usage

- Use the header (top-right controls) to import or export data.
- Supported import file types: `.json`, `.ged`, `.gedcom`.
- Export options: JSON or GEDCOM from the current tree.
- Example sample GEDCOM: [data/complex_2000.ged](data/complex_2000.ged).

## Data & Scripts

- Sample GEDCOM files live in [data/](data/).
- Use the scripts in `scripts/` to generate sample GEDCOM files:

```bash
node scripts/generate_gedcom.js
# or
node scripts/generate_gedcom.cjs
```

## Development

- The app uses `useTreeStore` (Zustand) for state and `utils/gedcomHandler.ts` / `utils/jsonHandler.ts` for import/export.
- Internationalization is handled via `react-i18next` — toggle language from the header.

## Offline access

Arbor is a local-first, client-only app (data lives in the browser via `localforage`), so it works two ways when the hosted site is unreachable:

- **PWA** — the web build (`npm run build`) registers a service worker that precaches the app shell, so once visited it keeps working offline and is installable from the browser's "Install app" prompt. When a new version is deployed, a toast offers to reload into it — nothing switches over without confirming.
- **Desktop app (Tauri)** — a native, lightweight executable (a few MB, no bundled browser) for macOS/Windows/Linux:

  ```bash
  npm run tauri:dev    # run the desktop shell locally
  npm run tauri:build  # build a release binary for the current OS
  ```

  The desktop build checks GitHub Releases for updates shortly after launch and shows a modal with the changelog; nothing downloads or installs until the user clicks "Update Now".

  Releases are published automatically by `.github/workflows/release-desktop.yml` on every push to `main`, versioned from [Conventional Commits](https://www.conventionalcommits.org/) since the last `arbor-v*` tag (`fix:` → patch, `feat:` → minor, `!:`/`BREAKING CHANGE:` → major; no matching commits → no release). It bumps `src-tauri/tauri.conf.json`/`Cargo.toml`, tags, builds for macOS/Windows/Linux, and opens a **draft** GitHub release — review and publish it manually. A specific version can also be forced via "Run workflow" in the Actions tab. It needs two repo secrets:
  - `TAURI_SIGNING_PRIVATE_KEY` / `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` — generate with `npx tauri signer generate -w /path/outside/repo/arbor.key`; the private key must **never** be committed. The matching public key is already in `src-tauri/tauri.conf.json`.

## Contributing

Contributions are welcome. Please open issues for bugs or feature requests and submit small, focused pull requests. When adding features, update this README as needed and include sample data if appropriate.

## Authors & Contributors

Original author: Arnaud BEUX

For a full list of contributors see the repository contributor list.

## License

MIT
