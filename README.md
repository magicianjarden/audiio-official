# Audiio Desktop & Web – Debian Build Fork

This repository is a maintained fork of the original **audiio-official** project, focused on:

- Reliable **Linux (Debian/Ubuntu)** desktop builds  
- Clean **cross‑platform Electron packaging**  
- Improved **workspace resolution** for monorepo packages  
- Stable **production builds** for landing + mobile remote portal  
- Fixes for ESM, ML‑core exports, and Electron runtime issues  

It tracks upstream changes from the original project:  
👉 **Source repository:** https://github.com/magicianjarden/audiio-official

This fork adds improvements required for reproducible Linux builds and stable desktop packaging.

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

---

## Building the Desktop App (Debian/Ubuntu)

### Install dependencies
npm install

### Build all workspaces
npm run build

### Build the Linux desktop app
npm run build:linux --workspace=@audiio/desktop

This produces:

- `.deb` installer  
- `.AppImage` binary  

Both verified to run cleanly on Debian-based systems.

---

## Releases

You can download prebuilt `.deb` and `.AppImage` binaries here:  
👉 **Releases:** https://github.com/cpntodd/audiio-official-test-debian/releases

---

## Syncing With Upstream

This fork tracks:

magicianjarden/audiio-official:main

To pull upstream changes:

git fetch upstream
git merge upstream/main

Or, for a clean rebase:

git fetch upstream
git reset --hard upstream/main

---

## Contributing

If you want to contribute improvements to the Linux build pipeline, feel free to open a PR on this fork.  
For upstream feature development, submit PRs to the original repo.

---

## Maintainer

**oddsoul (cpntodd)**  
Focused on cross‑platform builds, Debian packaging, and monorepo stability.
