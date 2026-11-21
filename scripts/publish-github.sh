#!/usr/bin/env bash
# Publishes this folder as <your-account>/bolt-markets on GitHub and turns on GitHub Pages (Actions).
#
#   ./scripts/publish-github.sh [repo-name]
#   API_URL=https://bolt-markets-api.onrender.com ./scripts/publish-github.sh   # also sets VITE_API_URL
#
# Needs git and the GitHub CLI (https://cli.github.com), signed in with `gh auth login`.
set -euo pipefail

REPO_NAME="${1:-BoltMarket}"
cd "$(dirname "$0")/.."

command -v git >/dev/null || { echo "git is required"; exit 1; }
command -v gh >/dev/null || { echo "Install the GitHub CLI first: https://cli.github.com"; exit 1; }
gh auth status >/dev/null 2>&1 || { echo "Run: gh auth login"; exit 1; }
OWNER="$(gh api user -q .login)"

if [ ! -d .git ]; then
  git init -q -b main
  git add -A
  git commit -q -m "Bolt Markets: website, client portal, back office and API"
fi

# Refuse to publish environment files with real values.
if git ls-files | grep -E '(^|/)\.env($|\.)' | grep -v '\.env\.example$' | grep -q .; then
  echo "Refusing to publish: an .env file is tracked by git. Remove it with 'git rm --cached <file>'."
  exit 1
fi

if gh repo view "$OWNER/$REPO_NAME" >/dev/null 2>&1; then
  git remote get-url origin >/dev/null 2>&1 || git remote add origin "https://github.com/$OWNER/$REPO_NAME.git"
else
  # GitHub Pages on a private repository needs a paid GitHub plan, so the default is public.
  gh repo create "$OWNER/$REPO_NAME" --public --source . --remote origin \
    --description "Bolt Markets: website, client portal, back office and API"
fi
git push -u origin main

# GitHub Pages, built by the "Website (GitHub Pages)" workflow
gh api -X POST "repos/$OWNER/$REPO_NAME/pages" -f build_type=workflow >/dev/null 2>&1 \
  || gh api -X PUT "repos/$OWNER/$REPO_NAME/pages" -f build_type=workflow >/dev/null

if [ -n "${API_URL:-}" ]; then
  gh variable set VITE_API_URL --body "$API_URL" --repo "$OWNER/$REPO_NAME"
fi
gh workflow run pages.yml --repo "$OWNER/$REPO_NAME" >/dev/null 2>&1 || true

SITE_OWNER="$(printf '%s' "$OWNER" | tr '[:upper:]' '[:lower:]')"
echo
echo "Repository:   https://github.com/$OWNER/$REPO_NAME"
echo "Website:      https://$SITE_OWNER.github.io/$REPO_NAME/  (ready when the Pages workflow finishes)"
echo "Back office:  https://$SITE_OWNER.github.io/$REPO_NAME/admin/"
echo
echo "Next: deploy the API on Render with render.yaml (see README), then run"
echo "  gh variable set VITE_API_URL --body https://<your-api>.onrender.com && gh workflow run pages.yml"
