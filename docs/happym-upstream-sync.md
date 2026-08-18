# Upstream synchronization

Remotes are configured as:

```text
origin   https://github.com/omelyk/HappyM.Postiz.git
upstream https://github.com/gitroomhq/postiz-app.git (push disabled)
```

Update on a dedicated branch, never directly on `dev`:

```powershell
git fetch upstream --tags
git switch -c chore/upstream-vX.Y.Z dev
git merge --no-ff vX.Y.Z
```

Resolve conflicts by preserving upstream behavior for normal Postiz sessions.
HappyM-specific code is concentrated under `happym-embed`, the explicit embed
route, controller guards and small optional callbacks in the standalone
composer. Run the targeted HappyM Jest suite, frontend type-check, upstream
build/tests and the two-pharmacy E2E suite before merging.

Record the new upstream commit and create `upstream-baseline-vX.Y.Z` only after
the upgrade gate is green.
