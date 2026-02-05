import * as core from '@actions/core';
import { getBranchName } from './git.js';
import {
  postMessage,
  addMessageId,
  updateMessage,
  postThreadReply,
  searchExistingMessage,
} from './slack.js';

async function run() {
  try {
    // Get inputs
    const inputs = {
      repo: core.getInput('repo', { required: true }),
      network: core.getInput('network', { required: true }),
      branch: core.getInput('branch'), // Optional - will fallback to getBranchName()
      description: core.getInput('description') || 'Frontend deployment',
      slackUserToken: core.getInput('slack-user-token', { required: true }),
      slackBotToken: core.getInput('slack-bot-token', { required: true }),
      stagingUrl: core.getInput('staging_url', { required: true }),
      slackChannel: core.getInput('slack-channel') || 'frontend-staging',
    };

    // Step 1: Get branch name (from input, fallback to git context)
    const branchName = inputs.branch || getBranchName();
    core.setOutput('branch_name', branchName);
    core.setOutput('channel_name', inputs.slackChannel);
    core.info(`Branch: ${branchName}`);

    // Step 2: Search for existing Slack message
    const existingMessage = await searchExistingMessage({
      userToken: inputs.slackUserToken,
      channel: inputs.slackChannel,
      repo: inputs.repo,
      branchName,
    });

    core.setOutput('message_found', existingMessage ? 'true' : 'false');

    let messageTs;

    if (existingMessage) {
      // Update existing message and post thread reply
      core.info(`Found existing message: ${existingMessage.ts}`);
      core.setOutput('existing_message_ts', existingMessage.ts);
      core.setOutput('existing_channel_id', existingMessage.channelId);

      // Update main message with latest staging URL
      await updateMessage({
        botToken: inputs.slackBotToken,
        channelId: existingMessage.channelId,
        messageTs: existingMessage.ts,
        currentText: existingMessage.text,
        stagingUrl: inputs.stagingUrl,
      });

      // Post thread reply
      await postThreadReply({
        botToken: inputs.slackBotToken,
        channel: inputs.slackChannel,
        threadTs: existingMessage.ts,
        network: inputs.network,
        description: inputs.description,
        stagingUrl: inputs.stagingUrl,
        author: process.env.GITHUB_ACTOR,
      });

      messageTs = existingMessage.ts;
    } else {
      // Create new message
      core.info('Creating new message');
      core.setOutput('existing_message_ts', '');
      core.setOutput('existing_channel_id', '');

      const result = await postMessage({
        botToken: inputs.slackBotToken,
        channel: inputs.slackChannel,
        repo: inputs.repo,
        network: inputs.network,
        branchName,
        description: inputs.description,
        stagingUrl: inputs.stagingUrl,
        author: process.env.GITHUB_ACTOR,
      });

      messageTs = result.ts;

      // Update message to include the Message ID
      if (messageTs) {
        await addMessageId({
          botToken: inputs.slackBotToken,
          channelId: result.channelId,
          messageTs,
          originalText: result.text,
        });
      }
    }

    core.setOutput('message_ts', messageTs);
    core.info('Slack notification completed successfully');
  } catch (error) {
    // Don't fail the action, just log the error
    core.warning(`Slack notification failed: ${error.message}`);
    core.info('Continuing despite notification failure...');
  }
}

run().catch((error) => {
  core.setFailed(`Unexpected error: ${error.message}`);
  process.exit(1);
});
