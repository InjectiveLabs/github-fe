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

```
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
- **Workflow files**: `.github/workflows/*.yml` for compromised actions

The scan runs **before `pnpm install`** in deploy workflows, so it only analyzes committed files (lockfile, package.json, source code).

## Exit Codes

| Code | Meaning | Action |
|------|---------|--------|
| 0 | Clean - no issues | Pass |
| 1 | HIGH risk - compromised packages found | Fail workflow |
| 2 | MEDIUM risk - suspicious patterns found | Fail workflow (conservative) |

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

## Known Limitations

- **Exact version matching only** - `compromised-packages-custom.txt` requires listing every vulnerable version explicitly. Semver range matching (`>=14.0.0 <14.2.25`) is not supported by the detector.
- **Pre-install only** - scans committed files, not transitive runtime dependencies (those are in lockfile though).

## References

- Detector repo: https://github.com/Cobenian/shai-hulud-detect
- Shai-Hulud attack: https://www.stepsecurity.io/blog/ctrl-tinycolor-and-40-npm-packages-compromised
- Next.js CVE-2025-29927: https://github.com/vercel/next.js/security/advisories/GHSA-f82v-jwr5-mffw
