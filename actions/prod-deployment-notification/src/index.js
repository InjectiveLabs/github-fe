import * as core from '@actions/core';
import { buildDeploymentPayload, sendSlackNotification, convertMarkdownToSlack } from './slack.js';

async function run() {
  try {
    // Get inputs
    const webhookUrl = core.getInput('webhook-url', { required: true });
    const projectName = core.getInput('project-name', { required: true });
    const releaseNotes = core.getInput('release-notes', { required: true });
    
    // Get repository and run ID from GitHub context
    const repository = process.env.GITHUB_REPOSITORY;
    const runId = process.env.GITHUB_RUN_ID;
    const repoUrl = `https://github.com/${repository}`;
    
    core.info(`Sending deployment notification for ${projectName}`);
    core.info(`Repository: ${repository}`);
    core.info(`Run ID: ${runId}`);
    
    // Build the payload
    const payload = buildDeploymentPayload({
      projectName,
      releaseNotes,
      repoUrl,
      runId,
    });
    
    // Log formatted notes for debugging
    if (releaseNotes !== 'No new commits') {
      core.info('Formatted release notes for Slack:');
      core.info(convertMarkdownToSlack(releaseNotes));
    }
    
    // Send to Slack
    await sendSlackNotification(webhookUrl, payload);
    
    core.info('Slack notification sent successfully');
  } catch (error) {
    core.warning(`Slack notification failed: ${error.message}`);
    core.info('Continuing despite notification failure...');
  }
}

run();
