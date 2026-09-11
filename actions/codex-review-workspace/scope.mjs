import { execFileSync, spawnSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const ignoredLockfile = /^(?:package-lock\.json|pnpm-lock\.yaml|yarn\.lock)$/
const generatedFile = /(?:^|\/)[^/]+\.generated\.[^/]+$/
const vendorBundle = /(?:^|\/)charting_library\/bundles\//
const ignoredExtension = /\.(?:jpe?g|mp3|png|svg|webp|woff2)$/i
const maxReviewableFiles = 150
const maxChangedLines = 15000
const maxDiffBytes = 512 * 1024

export function isReviewable(file) {
  const basename = file.split('/').at(-1)
  return !ignoredLockfile.test(basename)
    && !generatedFile.test(file)
    && !vendorBundle.test(file)
    && !ignoredExtension.test(file)
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

function createDiff(workspace, files, diffPath) {
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
  if (result.status !== 0) throw new Error(result.stderr.toString('utf8').trim() || 'Could not create filtered diff.')
  writeFileSync(diffPath, result.stdout, { mode: 0o600 })
  return true
}

export function createScope(workspace, diffPath) {
  const { files, changedLines } = resolveChanges(workspace)
  const exceedsLimit = files.length > maxReviewableFiles || changedLines > maxChangedLines
  if (files.length === 0 || exceedsLimit) {
    return {
      files,
      changedLines,
      diffPath: '',
      reviewable: false,
      skipReason: exceedsLimit ? 'limit' : '',
    }
  }

  if (!createDiff(workspace, files, diffPath)) {
    return {
      files,
      changedLines,
      diffPath: '',
      reviewable: false,
      skipReason: 'diff-size',
    }
  }

  return { files, changedLines, diffPath, reviewable: true, skipReason: '' }
}

function setOutput(name, value) {
  if (process.env.GITHUB_OUTPUT) {
    writeFileSync(process.env.GITHUB_OUTPUT, `${name}=${value}\n`, { flag: 'a' })
  }
}

function main() {
  const workspace = process.env.GITHUB_WORKSPACE || process.cwd()
  const diffPath = path.join(process.env.RUNNER_TEMP || workspace, 'codex-review.diff')
  const scope = createScope(workspace, diffPath)
  setOutput('reviewable', String(scope.reviewable))
  setOutput('candidate-count', scope.files.length)
  setOutput('changed-lines', scope.changedLines)
  setOutput('diff-file', scope.diffPath)
  setOutput('skip-reason', scope.skipReason)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main()
}
