# Security Scan Action

Composite GitHub Action that scans projects for compromised npm packages using the [Cobenian/shai-hulud-detect](https://github.com/Cobenian/shai-hulud-detect) detector plus a custom blocklist for CVE-specific vulnerabilities.

## Features

- **2,100+ known compromised packages** from multiple supply chain attacks (Sept 2025 - May 2026)
- **Custom vulnerability blocklist** for tracking CVEs like Next.js CVE-2025-29927
- **pnpm lockfile scanning** - works with `pnpm-lock.yaml` natively
- **No npm execution** - pure bash script, no `npx` supply chain risk
- **Pinned to audited commit** - SHA `385da712193756a2e0a2e4be513587f3f506b334` (May 12, 2026)

## Usage

```yaml
- name: Validate build
  uses: InjectiveLabs/github-fe/actions/security-scan@master
```

With custom directory:

```yaml
- name: Validate build
  uses: InjectiveLabs/github-fe/actions/security-scan@master
  with:
    directory: ./packages/frontend
```

## How It Works

1. Clones `Cobenian/shai-hulud-detect` at pinned SHA `385da712193756a2e0a2e4be513587f3f506b334`
2. Verifies the checkout matches expected SHA (prevents tag mutation)
3. Merges `compromised-packages-custom.txt` into the detector's package list
4. Runs `shai-hulud-detector.sh` against the project directory
5. Fails workflow on HIGH or MEDIUM risk findings

## Adding New Vulnerabilities

When a new CVE is disclosed:

1. Open `actions/security-scan/compromised-packages-custom.txt`
2. Add affected package versions in `package:version` format with a comment block:

```text
# ========================================================================
# CVE-YYYY-NNNNN - Description (CVSS X.X)
# Affects: ...
# Patched versions: ...
# Link: https://...
# ========================================================================
package-name:1.2.3
package-name:1.2.4
```

3. PR + merge to `master`
4. All repos using this action pick it up automatically

## What Gets Scanned

- **Package manifests**: `package.json`
- **Lockfiles**: `pnpm-lock.yaml`, `package-lock.json`, `yarn.lock`
- **Code files**: `*.js`, `*.ts`, `*.mjs` for malicious patterns
- **Workflow files**: `.github/workflows/*.yml` for compromised GitHub Actions

The scan runs **before `pnpm install`** in deploy workflows, so it only analyzes committed files (lockfile, package.json, source code).

## Exit Codes

| Code | Meaning | Action |
|------|---------|--------|
| 0 | Clean - no issues | Pass |
| 1 | HIGH risk - compromised packages found | Fail workflow |
| 2 | MEDIUM risk - suspicious patterns found | Fail workflow (conservative) |

## Output Format

When vulnerabilities are detected, the action provides multiple layers of visibility:

### 1. Console Output
Full scan results with color-coded findings from the detector.

### 2. Extracted Package List
Clean list of vulnerable packages displayed separately:
```text
📋 Vulnerable Packages Detected
The following vulnerable packages were detected:

  ❌ next@14.2.15
  ❌ axios@1.14.1
  ❌ @ctrl/tinycolor@4.1.1
```

### 3. GitHub Annotations
Each vulnerable package creates a clickable error annotation in the GitHub Actions UI.

### 4. Job Summary
A markdown summary appears at the top of the workflow run:

```markdown
## 🚨 Security Scan Failed

**Vulnerable packages detected:**
- `next@14.2.15`
- `axios@1.14.1`
- `@ctrl/tinycolor@4.1.1`

**Action Required:** Update or remove these packages immediately.
```

## Security Guarantees

- **No remote code execution** - pure bash, no `npx` or `npm install`
- **Pinned dependencies** - detector repo pinned to exact SHA, verified after checkout
- **No telemetry** - detector runs offline, no network calls
- **Transparent package list** - both lists are version-controlled plain text

## Updating the Detector

To update to a newer version of `shai-hulud-detect`:

1. Review the new commits: https://github.com/Cobenian/shai-hulud-detect/commits/main
2. Test locally: `git clone https://github.com/Cobenian/shai-hulud-detect && cd shai-hulud-detect && ./shai-hulud-detector.sh /path/to/repo`
3. Update `DETECTOR_SHA` in `action.yml` to the new commit SHA
4. PR with description of what changed

Current pinned version: `385da712193756a2e0a2e4be513587f3f506b334` (May 12, 2026)

## Local Scanning

A TypeScript script is available for scanning all repos locally without CI:

```bash
# From the github-fe repo root:
pnpm scan                          # scans ~/Public/injective/ (default)
pnpm scan /path/to/repos           # scans a specific folder
```

The script (`scripts/scan-lockfiles.ts`) does the following:

1. Recursively finds all `pnpm-lock.yaml` files under the target folder (skips `node_modules`, `.git`, `dist`, etc.)
2. Fetches the upstream Cobenian compromised package list from GitHub (cached 24h in the OS temp directory (`os.tmpdir()`))
3. Merges it with `compromised-packages-custom.txt` for a combined check
4. Parses each lockfile (pnpm v9 format) and checks resolved packages against the combined list
5. Logs per-repo results with advisory/CVE metadata and a summary

### Output

Each repo is shown with its package count and status. Vulnerable packages include the campaign/CVE title and a source URL:

```text
📦 injective-hub
   pnpm-lock.yaml (1,204 packages)
   ❌ 1 vulnerable package:

   • next@14.2.15
     CVE-2025-29927 - Next.js Middleware Authorization Bypass (CVSS 9.1)
     https://github.com/vercel/next.js/security/advisories/GHSA-f82v-jwr5-mffw
```

The script always exits 0 — findings are informational for local use. The CI action handles enforcement.

## Known Limitations

- **Exact version matching only** - `compromised-packages-custom.txt` requires listing every vulnerable version explicitly. Semver range matching (`>=14.0.0 <14.2.25`) is not supported by the detector.
- **Pre-install only** - scans committed files, not transitive runtime dependencies (those are in lockfile though).

## References

- Detector repo: https://github.com/Cobenian/shai-hulud-detect
- Shai-Hulud attack: https://www.stepsecurity.io/blog/ctrl-tinycolor-and-40-npm-packages-compromised
- Next.js CVE-2025-29927: https://github.com/vercel/next.js/security/advisories/GHSA-f82v-jwr5-mffw
