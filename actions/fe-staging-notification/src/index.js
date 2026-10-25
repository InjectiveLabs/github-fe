import * as core from '@actions/core';
import { getBranchName } from './git.js';
import { getCommitMessages } from './commits.js';
import {
  lookupIssue,
  postIssueComment,
  formatLinearComment,
  extractLinearTickets,
} from './linear.js';
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
      linearApiKey: core.getInput('linear-api-key'),
      commitMessages: core.getInput('commit-messages'),
      prTitle: core.getInput('pr-title'),
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

    // Step 5: Linear ticket integration
    if (inputs.linearApiKey) {
      try {
        // Gather text sources for ticket extraction
        const eventMessages = getCommitMessages();
        const manualMessages = inputs.commitMessages
          ? inputs.commitMessages.split('\n').filter(Boolean)
          : [];
        const allTexts = [...eventMessages, ...manualMessages, inputs.prTitle].filter(Boolean);

        const ticketIds = extractLinearTickets(allTexts);

        if (ticketIds.length === 0) {
          core.info('No Linear tickets found in commits or PR title');
          core.setOutput('linear_tickets', '');
          core.setOutput('linear_links', '');
        } else {
          core.info(`Found Linear tickets: ${ticketIds.join(', ')}`);

          // Look up each ticket and post comments
          const validIssues = [];
          for (const ticketId of ticketIds) {
            const issue = await lookupIssue(ticketId, inputs.linearApiKey);
            if (issue) {
              validIssues.push(issue);

              const commentBody = formatLinearComment({
                repo: inputs.repo,
                branchName,
                stagingUrl: inputs.stagingUrl,
                author: process.env.GITHUB_ACTOR,
              });

              await postIssueComment(issue.id, commentBody, inputs.linearApiKey);
              core.info(`Posted staging comment on ${issue.identifier}`);
            } else {
              core.info(`Linear ticket ${ticketId} not found, skipping`);
            }
          }

          // Post Slack thread reply with Linear ticket summary
          if (validIssues.length > 0 && messageTs) {
            const ticketList = validIssues
              .map((issue) => `• <${issue.url}|${issue.identifier}> - ${issue.title}`)
              .join('\n');

            // const channelId = existingMessage
            //   ? existingMessage.channelId
            //   : undefined;

            await postThreadReply({
              botToken: inputs.slackBotToken,
              channel: inputs.slackChannel,
              threadTs: messageTs,
              network: inputs.network,
              description: `Linear tickets linked:\n${ticketList}`,
              stagingUrl: inputs.stagingUrl,
              author: process.env.GITHUB_ACTOR,
            });
          }

          core.setOutput('linear_tickets', validIssues.map((i) => i.identifier).join(','));
          core.setOutput('linear_links', validIssues.map((i) => i.url).join(','));
        }
      } catch (linearError) {
        core.warning(`Linear integration failed: ${linearError.message}`);
        core.setOutput('linear_tickets', '');
        core.setOutput('linear_links', '');
      }
    } else {
      core.setOutput('linear_tickets', '');
      core.setOutput('linear_links', '');
    }
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
