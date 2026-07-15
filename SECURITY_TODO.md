# SECURITY_TODO.md — Action Required by Maintainer

This file documents security issues that **require manual action by a human maintainer**.
They cannot be safely automated without the risk of data loss or service disruption.

---

## 1. SSH Keys Exposed in Git History

**Status:** Keys moved to `infra/` and untracked from git (commit `4a74671`).
Keys are no longer pushed to the remote repo going forward.

**Action Required:**
- The keys (`Gym Buddy.pem` / `Gym Buddy.ppk`) were present in earlier commits and are
  therefore still visible in the repository's git history.
- **Treat them as compromised.** Rotate/revoke them on their cloud provider immediately.
- To purge them from git history, run:
  ```bash
  git filter-repo --path "Gym Buddy.pem" --path "Gym Buddy.ppk" --invert-paths
  git push origin --force --all
  ```
  ⚠️ This rewrites history — coordinate with all collaborators first.

---

## 2. JWT Secret Key

**Status:** Hardcoded fallback `"super-secret-gym-buddy-key-123456789"` removed from
`backend/dependencies.py` (commit after Phase 0). The server now exits at startup if
`JWT_SECRET_KEY` is not set in the environment.

**Action Required:**
- Rotate the JWT secret on Render (Environment → `JWT_SECRET_KEY`).
- Use a long, cryptographically random string (≥ 32 chars):
  ```bash
  python -c "import secrets; print(secrets.token_hex(32))"
  ```
- All existing user sessions will be invalidated when the key changes — this is expected.

---

## 3. NVIDIA API Key

**Status:** A live NVIDIA NIM API key was found in `backend-server/.env` and in a
temporary test file (`backend-server/test_key.py`, since removed from git history via
rebase in commit `1201f73`).

**Action Required:**
- Verify the key has not been pushed to the public remote at any point.
- If uncertain, rotate it at [build.nvidia.com](https://build.nvidia.com/).

---

## 4. `.env` File Committed in Past

**Status:** `git log --follow -- backend-server/.env` shows `.env` was committed in
commits `4a74671` and `dd3da65`. Even though `.env` is now gitignored, its contents
are still visible in those older commits.

**Action Required:**
- Rotate all keys referenced in `.env` (see items 2 and 3 above).
- To purge `.env` from history:
  ```bash
  git filter-repo --path backend-server/.env --invert-paths
  git push origin --force --all
  ```
