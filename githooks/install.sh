#!/bin/sh
# FHE — install the repo's hooks somewhere a checkout cannot delete them.
#
# WHY NOT JUST core.hooksPath=githooks
#   Because `githooks/` is TRACKED. Check out a commit from before these hooks
#   existed and the directory vanishes from the working tree — so core.hooksPath
#   points at nothing and BOTH hooks silently stop working. That is the exact
#   moment they are meant to fire: someone has just moved the canonical checkout
#   onto an older tree.
#
#   Found by testing rather than by reading: `git checkout 7cfe8b6` made
#   ./githooks/post-checkout return "no such file or directory".
#
#   So: the repo holds the SOURCE (reviewable, versioned, diffable) and this script
#   copies it into .git/, which no checkout touches. Worktrees share the same
#   .git common dir, so one install covers every worktree.
#
# RUN AFTER PULLING A CHANGE TO githooks/ — the copy is a snapshot, not a link.

set -e
COMMON=$(git rev-parse --git-common-dir)
case "$COMMON" in /*) ;; *) COMMON="$(pwd)/$COMMON" ;; esac   # make absolute
DEST="$COMMON/fhe-hooks"
SRC="$(git rev-parse --show-toplevel)/githooks"

mkdir -p "$DEST"
for h in pre-commit post-checkout; do
  cp "$SRC/$h" "$DEST/$h"
  chmod +x "$DEST/$h"
done

git config core.hooksPath "$DEST"

echo "installed -> $DEST"
echo "core.hooksPath = $(git config core.hooksPath)"
ls -l "$DEST"
