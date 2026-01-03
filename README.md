# Audiio Desktop & Web – Debian Build Fork

This repository is a maintained fork of the original **audiio-official** project, focused on:

- Reliable **Linux (Debian/Ubuntu)** desktop builds  
- Clean **cross‑platform Electron packaging**  
- Improved **workspace resolution** for monorepo packages  
- Stable **production builds** for landing + mobile remote portal  
- Fixes for ESM, ML‑core exports, and Electron runtime issues  

It tracks upstream changes from  
`magicianjarden/audiio-official`  
while adding improvements required for reproducible Linux builds.

---

## Why This Fork Exists

The upstream project is evolving quickly, with frequent restructures and large merges.  
This fork provides:

- A stable environment for **desktop packaging**  
- Verified `.deb` and AppImage builds  
- A clean Electron Builder configuration  
- Fixes for missing resources and workspace path issues  
- A reproducible build pipeline for Debian-based systems  

If you’re trying to build the Audiio desktop app on Linux, this fork is the most reliable starting point.

---

## Features Added in This Fork

### Desktop (Electron)
- Full cross‑platform Electron Builder config  
- `extraResources` for ML models, assets, and shared files  
- Fixed workspace resolution for monorepo packages  
- ESM compatibility fixes  
- Verified `.deb` and AppImage builds  
- Clean production boot (no missing‑file errors)

### Monorepo Improvements
- Updated ML‑core exports  
- Fixed workspace paths for Electron runtime  
- Consistent build scripts across packages  

### Web / Mobile
- Updated GitHub Pages workflow (optional)  
- Combined landing + mobile remote portal build output  
- Production‑ready builds for both web apps  

---

## Repository Structure

packages/
desktop/        # Electron app (Linux/Windows/macOS)
landing/        # Marketing site
mobile/         # Remote control web app
icons/          # Shared icon build pipeline
ml-core/        # Machine learning core
ml-sdk/         # ML SDK
ui/             # Shared UI components

Code

---

## Building the Desktop App (Debian/Ubuntu)

### Install dependencies
npm install

Code

### Build all workspaces
npm run build

Code

### Build the Linux desktop app
npm run build:linux --workspace=@audiio/desktop

Code

This produces:

- `.deb` installer  
- `.AppImage` binary  

Both verified to run cleanly on Debian-based systems.

---

## Syncing With Upstream

This fork tracks:

magicianjarden/audiio-official:main

Code

To pull upstream changes:

git fetch upstream
git merge upstream/main

Code

Or, for a clean rebase:

git fetch upstream
git reset --hard upstream/main

Code

---

## Contributing

If you want to contribute improvements to the Linux build pipeline, feel free to open a PR on this fork.  
For upstream feature development, submit PRs to the original repo.

---

## Maintainer

**Eli (cpntodd)**  
Focused on cross‑platform builds, Debian packaging, and monorepo stability.
