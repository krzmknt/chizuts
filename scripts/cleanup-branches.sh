#!/bin/bash

# Cleanup branches that are fully merged into main
# Usage: ./scripts/cleanup-branches.sh [--dry-run]

set -e

DRY_RUN=false
if [[ "$1" == "--dry-run" ]]; then
  DRY_RUN=true
  echo "=== DRY RUN MODE ==="
  echo ""
fi

MAIN_BRANCH="main"

# Fetch latest from remote
echo "Fetching latest from remote..."
git fetch --prune origin

echo ""
echo "=== Branches to delete ==="
echo ""

# Get merged branches (excluding main and current branch)
MERGED_LOCAL=$(git branch --merged "$MAIN_BRANCH" | grep -v "^\*" | grep -v "^  $MAIN_BRANCH$" | sed 's/^  //')
MERGED_REMOTE=$(git branch -r --merged "origin/$MAIN_BRANCH" | grep "origin/" | grep -v "origin/$MAIN_BRANCH" | grep -v "origin/HEAD" | sed 's|origin/||')

# Local branches
if [[ -n "$MERGED_LOCAL" ]]; then
  echo "Local branches merged into $MAIN_BRANCH:"
  echo "$MERGED_LOCAL" | while read branch; do
    echo "  - $branch"
  done
  echo ""
else
  echo "No local branches to delete."
  echo ""
fi

# Remote branches
if [[ -n "$MERGED_REMOTE" ]]; then
  echo "Remote branches merged into $MAIN_BRANCH:"
  echo "$MERGED_REMOTE" | while read branch; do
    echo "  - origin/$branch"
  done
  echo ""
else
  echo "No remote branches to delete."
  echo ""
fi

if [[ "$DRY_RUN" == "true" ]]; then
  echo "=== DRY RUN - No branches deleted ==="
  echo "Run without --dry-run to actually delete branches."
  exit 0
fi

# Confirm before deletion
echo "Do you want to delete these branches? (y/N)"
read -r confirm
if [[ "$confirm" != "y" && "$confirm" != "Y" ]]; then
  echo "Aborted."
  exit 0
fi

echo ""
echo "=== Deleting branches ==="
echo ""

# Delete local branches
if [[ -n "$MERGED_LOCAL" ]]; then
  echo "$MERGED_LOCAL" | while read branch; do
    echo "Deleting local branch: $branch"
    git branch -d "$branch" 2>/dev/null || echo "  (skipped - may have unmerged commits)"
  done
fi

# Delete remote branches
if [[ -n "$MERGED_REMOTE" ]]; then
  echo "$MERGED_REMOTE" | while read branch; do
    echo "Deleting remote branch: origin/$branch"
    git push origin --delete "$branch" 2>/dev/null || echo "  (skipped - may not exist or protected)"
  done
fi

echo ""
echo "=== Done ==="
