import * as core from '@actions/core';
import { generateReleaseNotes, computeBugsnagVersion } from './release-notes.js';

async function run() {
  try {
    // Get inputs
    const previousTag = core.getInput('previous_tag', { required: true });
    const repoUrl = core.getInput('repo_url', { required: true });
    const branch = core.getInput('branch') || 'master';
    
    core.info(`Generating release notes from ${previousTag} to ${branch}`);
    core.info(`Repository: ${repoUrl}`);
    
    // Generate release notes
    const result = await generateReleaseNotes({
      previousTag,
      repoUrl,
      branch,
    });
    
    // Set outputs
    core.setOutput('new_version', result.newVersion);
    core.setOutput('release_notes', result.releaseNotes);
    
    // Compute Bugsnag version
    const bugsnagVersion = computeBugsnagVersion(
      result.newVersion,
      previousTag,
      result.hasNewCommits
    );
    core.setOutput('bugsnag_version', bugsnagVersion);
    
    // Log summary
    core.info(`New version: ${result.newVersion}`);
    core.info(`Bugsnag version: ${bugsnagVersion}`);
    core.info(`Commits found: ${result.commits.length}`);
    
    if (result.hasNewCommits) {
      core.info('Release notes:');
      core.info(result.releaseNotes);
    } else {
      core.info('No new commits found');
    }
  } catch (error) {
    core.setFailed(`Release notes generation failed: ${error.message}`);
  }
}

run().catch((error) => {
  core.setFailed(`Unexpected error: ${error.message}`);
  process.exit(1);
});
