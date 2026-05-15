import { readFileSync, readdirSync, statSync, mkdirSync, writeFileSync } from 'node:fs'
import { resolve, relative, dirname, basename, join } from 'node:path'
import { homedir, tmpdir } from 'node:os'
import { execSync } from 'node:child_process'
import { parse as parseYaml } from 'yaml'

// ─── Constants ──────────────────────────────────────────────────────────────

const DETECTOR_SHA = '385da712193756a2e0a2e4be513587f3f506b334'
const UPSTREAM_URL = `https://raw.githubusercontent.com/Cobenian/shai-hulud-detect/${DETECTOR_SHA}/compromised-packages.txt`
const CACHE_DIR = join(tmpdir(), 'shai-hulud-scanner')
const CACHE_FILE = join(CACHE_DIR, `compromised-packages-${DETECTOR_SHA}.txt`)
const CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000

const SCRIPT_DIR = dirname(new URL(import.meta.url).pathname)
const REPO_ROOT = resolve(SCRIPT_DIR, '..')
const CUSTOM_LIST_PATH = join(REPO_ROOT, 'actions', 'security-scan', 'compromised-packages-custom.txt')

const DEFAULT_SCAN_PATH = join(homedir(), 'Public', 'injective')

const SKIP_DIRS = new Set([
  'node_modules', '.git', 'dist', 'build', '.output', '.nuxt',
  '.venv', 'venv', '__pycache__', 'site-packages', 'coverage',
  'target', '.next', '.cache', '.turbo',
])

// ─── Types ──────────────────────────────────────────────────────────────────

interface Advisory {
  title: string
  url: string
}

interface Finding {
  pkg: string
  version: string
  advisory: Advisory
  repos: string[]
}

// ─── Colours (ANSI) ─────────────────────────────────────────────────────────

const c = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
}

// ─── Utilities ──────────────────────────────────────────────────────────────

function splitPkgKey(key: string): { name: string; version: string } | null {
  const atIdx = key.lastIndexOf('@')
  if (atIdx <= 0) return null
  return { name: key.slice(0, atIdx), version: key.slice(atIdx + 1) }
}

function findLockfiles(dir: string): string[] {
  const results: string[] = []

  function walk(current: string) {
    let entries: string[]
    try {
      entries = readdirSync(current)
    } catch {
      return
    }

    for (const entry of entries) {
      if (SKIP_DIRS.has(entry)) continue
      if (entry.startsWith('.') && entry !== '.') continue

      const full = join(current, entry)
      let stat
      try {
        stat = statSync(full)
      } catch {
        continue
      }

      if (stat.isDirectory()) {
        walk(full)
      } else if (entry === 'pnpm-lock.yaml') {
        results.push(full)
      }
    }
  }

  walk(dir)
  return results.sort()
}

// ─── Package list loader ────────────────────────────────────────────────────

function fetchUpstreamList(): string {
  try {
    const stat = statSync(CACHE_FILE)
    if (Date.now() - stat.mtimeMs < CACHE_MAX_AGE_MS) {
      return readFileSync(CACHE_FILE, 'utf-8')
    }
  } catch {}

  console.log(`${c.dim}   Fetching upstream compromised-packages.txt (SHA: ${DETECTOR_SHA.slice(0, 12)}...)${c.reset}`)

  try {
    const content = execSync(`curl -fsSL "${UPSTREAM_URL}"`, {
      encoding: 'utf-8',
      timeout: 30_000,
    })

    mkdirSync(CACHE_DIR, { recursive: true })
    writeFileSync(CACHE_FILE, content, 'utf-8')

    return content
  } catch {
    try {
      console.log(`${c.yellow}   Warning: Could not fetch upstream list, using stale cache${c.reset}`)
      return readFileSync(CACHE_FILE, 'utf-8')
    } catch {
      console.log(`${c.red}   Error: Could not fetch upstream list and no cache available${c.reset}`)
      throw new Error('Could not obtain compromised package database: upstream fetch failed and no cache available')
    }
  }
}

function parsePackageList(content: string, source: 'upstream' | 'custom'): Map<string, Advisory> {
  const map = new Map<string, Advisory>()
  const lines = content.split('\n')

  let currentTitle = ''
  let currentUrl = ''
  let inSection = false

  for (const rawLine of lines) {
    const line = rawLine.trim()

    // Upstream format: # MONTH YEAR - TITLE (count)
    // Custom format: # CVE-YYYY-NNNNN - Title (CVSS X.X)
    if (line.startsWith('# ===')) {
      inSection = !inSection
      continue
    }

    if (inSection && line.startsWith('#')) {
      const text = line.replace(/^#\s*/, '')

      if (!currentTitle && text.length > 0 && !text.startsWith('Source:') && !text.startsWith('http')) {
        currentTitle = text
      }

      const urlMatch = text.match(/^(?:Source:\s*)?(https?:\/\/\S+)/)
      if (urlMatch) {
        currentUrl = urlMatch[1]
      }
      continue
    }

    if (line.startsWith('#') || line.length === 0) continue

    // Skip pypi entries for pnpm scanning
    if (line.startsWith('pypi:')) continue

    const entry = line.startsWith('npm:') ? line.slice(4) : line

    const colonIdx = entry.lastIndexOf(':')
    if (colonIdx <= 0) continue

    const pkg = entry.slice(0, colonIdx)
    const version = entry.slice(colonIdx + 1)
    if (!version || !version.match(/^\d/)) continue

    const key = `${pkg}@${version}`
    if (!map.has(key)) {
      map.set(key, {
        title: currentTitle || (source === 'upstream' ? 'Shai-Hulud Supply Chain Attack' : 'Custom Blocklist'),
        url: currentUrl || '',
      })
    }
  }

  return map
}

function loadCompromisedPackages(): { map: Map<string, Advisory>; upstreamCount: number; customCount: number } {
  const map = new Map<string, Advisory>()

  const upstreamContent = fetchUpstreamList()
  const upstreamMap = parsePackageList(upstreamContent, 'upstream')
  for (const [key, advisory] of upstreamMap) {
    map.set(key, advisory)
  }
  const upstreamCount = upstreamMap.size

  let customCount = 0
  try {
    const customContent = readFileSync(CUSTOM_LIST_PATH, 'utf-8')
    const customMap = parsePackageList(customContent, 'custom')
    for (const [key, advisory] of customMap) {
      map.set(key, advisory)
    }
    customCount = customMap.size
  } catch {}

  return { map, upstreamCount, customCount }
}

// ─── pnpm lockfile parser ───────────────────────────────────────────────────

function extractPackagesFromLockfile(lockfilePath: string): Map<string, string> {
  const packages = new Map<string, string>()
  const content = readFileSync(lockfilePath, 'utf-8')

  let parsed: Record<string, unknown>
  try {
    parsed = parseYaml(content) as Record<string, unknown>
  } catch {
    return packages
  }

  const pkgs = parsed.packages as Record<string, unknown> | undefined
  if (!pkgs) return packages

  for (const key of Object.keys(pkgs)) {
    const parts = splitPkgKey(key)
    if (!parts) continue

    // pnpm v9 peer dep variants encode constraints after +, strip it
    const cleanVersion = parts.version.split('+')[0]
    if (!cleanVersion.match(/^\d+\.\d+\.\d+/)) continue

    packages.set(`${parts.name}@${cleanVersion}`, parts.name)
  }

  return packages
}

// ─── Main ───────────────────────────────────────────────────────────────────

function main() {
  const scanPath = resolve(process.argv[2] || DEFAULT_SCAN_PATH)

  console.log('')
  console.log(`${c.blue}${c.bold}🔍 Scanning ${scanPath} for pnpm lockfiles...${c.reset}`)
  console.log('')

  try {
    if (!statSync(scanPath).isDirectory()) throw new Error()
  } catch {
    console.log(`${c.red}Error: ${scanPath} is not a valid directory.${c.reset}`)
    process.exit(0)
  }

  const lockfiles = findLockfiles(scanPath)
  if (lockfiles.length === 0) {
    console.log(`${c.yellow}No pnpm-lock.yaml files found.${c.reset}`)
    process.exit(0)
  }

  console.log(`${c.dim}Found ${lockfiles.length} lockfiles to scan.${c.reset}`)

  console.log(`${c.dim}Loading compromised package database...${c.reset}`)
  const { map: compromisedMap, upstreamCount, customCount } = loadCompromisedPackages()
  console.log(`${c.dim}Loaded ${compromisedMap.size} compromised packages (${upstreamCount} upstream + ${customCount} custom).${c.reset}`)
  console.log('')

  const allFindings = new Map<string, Finding>()
  let totalPackages = 0
  let cleanCount = 0
  let vulnerableCount = 0

  for (const lockfile of lockfiles) {
    const repoDir = dirname(lockfile)
    const repoName = basename(repoDir)
    const relPath = relative(scanPath, lockfile)

    const packages = extractPackagesFromLockfile(lockfile)
    const count = packages.size
    totalPackages += count

    const findings: { key: string; advisory: Advisory }[] = []

    for (const [pkgKey] of packages) {
      const advisory = compromisedMap.get(pkgKey)
      if (advisory) {
        findings.push({ key: pkgKey, advisory })

        if (allFindings.has(pkgKey)) {
          allFindings.get(pkgKey)!.repos.push(repoName)
        } else {
          const parts = splitPkgKey(pkgKey)!
          allFindings.set(pkgKey, {
            pkg: parts.name,
            version: parts.version,
            advisory,
            repos: [repoName],
          })
        }
      }
    }

    console.log(`${c.gray}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${c.reset}`)
    console.log(`${c.blue}${c.bold}📦 ${repoName}${c.reset}`)
    console.log(`${c.dim}   ${relPath} (${count.toLocaleString()} packages)${c.reset}`)

    if (findings.length === 0) {
      console.log(`   ${c.green}✅ Clean — no vulnerable packages${c.reset}`)
      cleanCount++
    } else {
      console.log(`   ${c.red}❌ ${findings.length} vulnerable package${findings.length > 1 ? 's' : ''}:${c.reset}`)
      console.log('')
      for (const { key, advisory } of findings) {
        console.log(`   ${c.red}${c.bold}• ${key}${c.reset}`)
        console.log(`     ${c.yellow}${advisory.title}${c.reset}`)
        if (advisory.url) {
          console.log(`     ${c.dim}${advisory.url}${c.reset}`)
        }
      }
      vulnerableCount++
    }
  }

  console.log('')
  console.log(`${c.cyan}${'═'.repeat(78)}${c.reset}`)
  console.log(`${c.cyan}${c.bold}📋 SUMMARY${c.reset}`)
  console.log(`${c.cyan}${'═'.repeat(78)}${c.reset}`)
  console.log(`${c.dim}Scanned:    ${lockfiles.length} repos (${totalPackages.toLocaleString()} total packages)${c.reset}`)
  console.log(`${c.green}Clean:      ${cleanCount}${c.reset}`)

  if (vulnerableCount > 0) {
    console.log(`${c.red}Vulnerable: ${vulnerableCount}${c.reset}`)
  } else {
    console.log(`${c.green}Vulnerable: 0${c.reset}`)
  }

  if (allFindings.size > 0) {
    console.log('')
    console.log(`${c.red}${c.bold}❌ All vulnerable packages:${c.reset}`)

    const sorted = [...allFindings.values()].sort((a, b) => a.pkg.localeCompare(b.pkg))
    for (const finding of sorted) {
      console.log('')
      console.log(`   ${c.red}${c.bold}• ${finding.pkg}@${finding.version}${c.reset}`)
      console.log(`     ${c.dim}Found in: ${finding.repos.join(', ')}${c.reset}`)
      console.log(`     ${c.yellow}${finding.advisory.title}${c.reset}`)
      if (finding.advisory.url) {
        console.log(`     ${c.dim}${finding.advisory.url}${c.reset}`)
      }
    }
  } else {
    console.log('')
    console.log(`${c.green}${c.bold}✅ All repos are clean — no compromised packages detected.${c.reset}`)
  }

  console.log(`${c.cyan}${'═'.repeat(78)}${c.reset}`)
  console.log('')
}

main()
