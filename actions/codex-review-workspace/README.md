# Codex Workspace Review

Reviews a filtered PR merge diff. Automatic runs skip PRs above 150 reviewable
files, 15,000 changed lines, or a 512 KiB filtered diff.

For a manual review, pass `bypass-limits: 'true'` to bypass all three size limits.
Filtering and merge-commit validation still apply. The calling workflow must
authorize the request before enabling this input.

```yaml
- uses: InjectiveLabs/github-fe/actions/codex-review-workspace@master
  with:
    pull-request-number: ${{ needs.resolve.outputs.pr_number }}
    openai-api-key: ${{ secrets.OPENAI_FE_API_KEY }}
    bypass-limits: ${{ needs.resolve.outputs.manual_command == '@codex_review' }}
```

In `injective-uis`, the PR workflow handles `@codex_review` comments from users
with write, maintain, or admin access. Both the command handler on the default
branch and this action update must be available before the command works.

Large manual reviews can use more API tokens and still exceed the model's
context limit or the calling job's timeout. This input defaults to `'false'`.
