import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { countChangedLines, createManifest, isReviewable, parseNameStatus } from './scope.mjs'

test('filters lockfiles, generated/vendor code, and binary assets', () => {
  for (const file of [
    'pnpm-lock.yaml',
    'packages/web/pnpm-lock.yaml',
    'apps/admin/package-lock.json',
    'shared/types/src/generated/other.generated.ts',
    'public/charting_library/bundles/1553.hash.js',
    'products/true-current/public/images/logo.png',
    'products/true-current/public/audio/order-fill.mp3',
    'products/true-current/public/fonts/Geist-Regular.woff2',
  ]) {
    assert.equal(isReviewable(file), false, file)
  }
})

test('retains ordinary source files', () => {
  assert.equal(isReviewable('apps/web/src/App.vue'), true)
  assert.equal(isReviewable('packages/sdk/src/client.ts'), true)
  assert.equal(isReviewable('products/true-current/public/_redirects'), true)
})

test('preserves rename paths from Git name-status output', () => {
  const files = parseNameStatus(Buffer.from('R100\0src/old.ts\0src/new.ts\0M\0src/app.ts\0'))
  assert.deepEqual(files, [
    { status: 'R100', previousPath: 'src/old.ts', path: 'src/new.ts' },
    { status: 'M', path: 'src/app.ts' },
  ])
})

test('counts only reviewable changed lines', () => {
  const numstat = Buffer.from('3\t2\tsrc/app.ts\n10\t5\tpnpm-lock.yaml\n-\t-\tpublic/logo.png\n')
  assert.equal(countChangedLines(numstat), 5)
})

test('writes a filtered manifest for a merge commit', () => {
  const workspace = mkdtempSync(path.join(tmpdir(), 'codex-review-workspace-'))
  const git = (...args) => execFileSync('git', args, { cwd: workspace })

  try {
    git('init', '--initial-branch=main')
    git('config', 'user.email', 'test@example.com')
    git('config', 'user.name', 'Test')
    git('config', 'commit.gpgsign', 'false')
    writeFileSync(path.join(workspace, 'app.ts'), 'export const version = 1\n')
    git('add', '.')
    git('commit', '-m', 'base')
    git('checkout', '-b', 'feature')
    writeFileSync(path.join(workspace, 'app.ts'), 'export const version = 2\n')
    writeFileSync(path.join(workspace, 'pnpm-lock.yaml'), 'lockfileVersion: 9\n')
    git('add', '.')
    git('commit', '-m', 'feature')
    git('checkout', 'main')
    git('merge', '--no-ff', 'feature', '-m', 'merge feature')

    const { files, changedLines, manifestPath } = createManifest(workspace)
    assert.deepEqual(files, [{ path: 'app.ts', status: 'M' }])
    assert.equal(changedLines, 2)
    assert.deepEqual(JSON.parse(readFileSync(manifestPath, 'utf8')).files, files)
  } finally {
    rmSync(workspace, { force: true, recursive: true })
  }
})
