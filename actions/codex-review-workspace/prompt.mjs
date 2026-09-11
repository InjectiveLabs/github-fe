import { writeFileSync } from 'node:fs'

const [outputFile] = process.argv.slice(2)
const repository = process.env.GITHUB_REPOSITORY
const serverUrl = process.env.GITHUB_SERVER_URL
const sha = process.env.GITHUB_SHA

if (!outputFile || !repository || !serverUrl || !sha) {
  throw new Error('Codex review prompt requires an output path and GitHub repository context.')
}

writeFileSync(outputFile, `Review the pull request checked out in this workspace.

The filtered changed-file manifest is at \`.git/codex-review-files.json\`.
Review only paths in that manifest. Use \`git diff HEAD^1 HEAD -- <path>\`
to inspect each relevant change, and read surrounding workspace code when needed.

Look for correctness, security, performance, edge cases, and maintainability
regressions. Do not report style-only observations. Return at most 20 actionable
findings, ordered by severity. If there are no findings, start the response with
\`LGTM\` and include the coverage line below.

End with one compact coverage line: \`Coverage: <inspected>/<candidate> files
reviewed.\` Only add \`Unreviewed: <paths>.\` when not every candidate file
was inspected.

File references must use this format:
\`[${repository}/path/to/file.ts:42](${serverUrl}/${repository}/blob/${sha}/path/to/file.ts#L42)\`.
`)
