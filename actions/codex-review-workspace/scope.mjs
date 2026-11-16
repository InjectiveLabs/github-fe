import { execFileSync, spawnSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

const ignoredLockfile = /^(?:package-lock\.json|pnpm-lock\.yaml|yarn\.lock)$/
const generatedFile = /(?:^|\/)[^/]+\.generated\.[^/]+$/
const vendorBundle = /(?:^|\/)charting_library\/bundles\//
const ignoredExtension = /\.(?:jpe?g|mp3|png|svg|webp|woff2)$/i
// JSON data: bootstrapped lists under json/, recorded test fixtures under fixtures/,
// and generated specs under generated/.
const dataJson = /(?:^|\/)(?:json|fixtures|generated)\/.+\.json$/i
const maxReviewableFiles = 150
const maxChangedLines = 15000
const maxDiffBytes = 512 * 1024

export function isReviewable(file) {
  const basename = file.split('/').at(-1)
  return !ignoredLockfile.test(basename)
    && !generatedFile.test(file)
    && !vendorBundle.test(file)
    && !ignoredExtension.test(file)
    && !dataJson.test(file)
}

export function parseNameStatus(output) {
  const fields = output.toString('utf8').split('\0')
  fields.pop()
  const files = []

  for (let index = 0; index < fields.length;) {
    const status = fields[index++]
    if (status.startsWith('R') || status.startsWith('C')) {
      const previousPath = fields[index++]
      const path = fields[index++]
      files.push({ path, previousPath, status })
    } else {
      files.push({ path: fields[index++], status })
    }
  }

  return files
}

export function countChangedLines(output) {
  const fields = output.toString('utf8').split('\0')
  fields.pop()
  let total = 0

  for (let index = 0; index < fields.length; index += 1) {
    const [added, deleted, file] = fields[index].split('\t')
    const destination = file || fields[index += 2]
    if (isReviewable(destination)) total += (Number(added) || 0) + (Number(deleted) || 0)
  }

  return total
}

function git(workspace, args) {
  return execFileSync('git', args, { cwd: workspace, encoding: 'buffer' })
}

function revision(workspace, ref, errorMessage) {
  try {
    return git(workspace, ['rev-parse', '--verify', ref]).toString('utf8').trim()
  } catch {
    throw new Error(errorMessage)
  }
}

export function resolveChanges(workspace) {
  revision(
    workspace,
    'HEAD^1',
    'codex-review-workspace requires the PR merge commit and its base parent.',
  )
  revision(
    workspace,
    'HEAD^2',
    'codex-review-workspace requires a merge commit with both parents.',
  )
  const changed = parseNameStatus(git(workspace, ['diff', '--name-status', '-z', '-M', 'HEAD^1', 'HEAD']))
  const files = changed.filter(({ path: file }) => isReviewable(file))
  const changedLines = countChangedLines(git(workspace, ['diff', '--numstat', '-z', '-M', 'HEAD^1', 'HEAD']))

  return { files, changedLines }
}

function fitsDiffSizeLimit(workspace, files) {
  const paths = [...new Set(files.flatMap(({ path: file, previousPath }) =>
    previousPath ? [previousPath, file] : [file]
  ))]
  const result = spawnSync(
    'git',
    ['diff', '--no-ext-diff', '--no-textconv', '-M', '--unified=20', 'HEAD^1', 'HEAD', '--', ...paths],
    { cwd: workspace, encoding: 'buffer', maxBuffer: maxDiffBytes + 1 },
  )
  if (result.error?.code === 'ENOBUFS') return false
  if (result.error) throw result.error
  if (result.status !== 0) throw new Error(result.stderr.toString('utf8').trim() || 'Could not measure filtered diff.')
  return true
}

function limitReason(workspace, files, changedLines) {
  if (files.length > maxReviewableFiles || changedLines > maxChangedLines) return 'limit'
  if (!fitsDiffSizeLimit(workspace, files)) return 'diff-size'
  return ''
}

export function createScope(workspace, bypassLimits = false) {
  const { files, changedLines } = resolveChanges(workspace)
  const skipReason = files.length === 0 || bypassLimits ? '' : limitReason(workspace, files, changedLines)
  return { files, changedLines, reviewable: files.length > 0 && !skipReason, skipReason }
}

function setOutput(name, value) {
  if (process.env.GITHUB_OUTPUT) {
    writeFileSync(process.env.GITHUB_OUTPUT, `${name}=${value}\n`, { flag: 'a' })
  }
}

function main() {
  const workspace = process.env.GITHUB_WORKSPACE || process.cwd()
  const scope = createScope(workspace, process.env.BYPASS_LIMITS === 'true')
  setOutput('reviewable', String(scope.reviewable))
  setOutput('candidate-count', scope.files.length)
  setOutput('changed-lines', scope.changedLines)
  setOutput('skip-reason', scope.skipReason)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main()
}
