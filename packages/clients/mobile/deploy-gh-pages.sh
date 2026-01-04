#!/bin/bash
# Deploy Audiio Mobile web app to GitHub Pages
#
# Usage: ./deploy-gh-pages.sh
#
# Prerequisites:
# - git configured with push access to your repo
# - npm run build already completed

set -e

# Build if not already built
if [ ! -d "dist/web" ]; then
  echo "Building web app..."
  npm run build:web
fi

# Navigate to built output
cd dist/web

# Initialize git repo for gh-pages
git init
git add -A
git commit -m 'Deploy to GitHub Pages'

# Force push to gh-pages branch
# Replace YOUR_USERNAME/YOUR_REPO with your actual repo
echo ""
echo "To deploy, run:"
echo "  git push -f git@github.com:YOUR_USERNAME/YOUR_REPO.git main:gh-pages"
echo ""
echo "Or for HTTPS:"
echo "  git push -f https://github.com/YOUR_USERNAME/YOUR_REPO.git main:gh-pages"
echo ""
echo "Then enable GitHub Pages in repo Settings > Pages > Source: gh-pages branch"
echo ""
echo "Your mobile web app will be available at:"
echo "  https://YOUR_USERNAME.github.io/YOUR_REPO/"

cd ../..
