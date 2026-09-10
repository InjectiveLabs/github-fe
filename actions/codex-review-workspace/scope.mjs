import { execFileSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const ignoredLockfile = /^(?:package-lock\.json|pnpm-lock\.yaml|yarn\.lock)$/
const generatedFile = /(?:^|\/)[^/]+\.generated\.[^/]+$/
const vendorBundle = /(?:^|\/)charting_library\/bundles\//
const ignoredExtension = /\.(?:jpe?g|mp3|png|svg|webp|woff2)$/i
const maxReviewableFiles = 150
const maxChangedLines = 15000

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
  return output.toString('utf8').split('\n').reduce((total, line) => {
    const [added, deleted, file] = line.split('\t')
    if (!file || !isReviewable(file)) return total
    return total + (Number(added) || 0) + (Number(deleted) || 0)
  }, 0)
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

export function createManifest(workspace) {
  const base = revision(
    workspace,
    'HEAD^1',
    'codex-review-workspace requires the PR merge commit. Check out refs/pull/<number>/merge with fetch-depth: 0.',
  )
  revision(
    workspace,
    'HEAD^2',
    'codex-review-workspace requires a merge commit with both parents. Check out refs/pull/<number>/merge with fetch-depth: 0.',
  )
  const head = revision(workspace, 'HEAD', 'codex-review-workspace could not resolve HEAD.')
  const changed = parseNameStatus(git(workspace, ['diff', '--name-status', '-z', '-M', 'HEAD^1', 'HEAD']))
  const files = changed.filter(({ path: file }) => isReviewable(file))
  const changedLines = countChangedLines(git(workspace, ['diff', '--numstat', '--no-renames', 'HEAD^1', 'HEAD']))
  const gitPath = git(workspace, ['rev-parse', '--git-path', 'codex-review-files.json']).toString('utf8').trim()
  const manifestPath = path.isAbsolute(gitPath) ? gitPath : path.resolve(workspace, gitPath)

  writeFileSync(manifestPath, `${JSON.stringify({ base, head, files, changedLines }, null, 2)}\n`)
  return { files, changedLines, manifestPath }
}

function setOutput(name, value) {
  if (process.env.GITHUB_OUTPUT) {
    writeFileSync(process.env.GITHUB_OUTPUT, `${name}=${value}\n`, { flag: 'a' })
  }
}

function main() {
  const workspace = process.env.GITHUB_WORKSPACE || process.cwd()
  const { files, changedLines } = createManifest(workspace)
  const exceedsLimit = files.length > maxReviewableFiles || changedLines > maxChangedLines
  setOutput('reviewable', String(files.length > 0 && !exceedsLimit))
  setOutput('candidate-count', files.length)
  setOutput('changed-lines', changedLines)
  setOutput('skip-reason', exceedsLimit ? 'limit' : '')
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main()
}
