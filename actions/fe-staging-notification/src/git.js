import { readFileSync } from 'fs';

/**
 * Get the branch name from GitHub context
 * Priority: 
 * 1. Action input (INPUT_BRANCH) - passed from workflow
 * 2. workflow_dispatch event input (github.event.inputs.branch)
 * 3. PR head ref (GITHUB_HEAD_REF)
 * 4. Current ref name (GITHUB_REF_NAME)
 */
export function getBranchName() {
  // 1. From action input (if workflow passes it)
  if (process.env.INPUT_BRANCH) {
    return process.env.INPUT_BRANCH;
  }

  // 2. Try to read from GitHub event payload (workflow_dispatch)
  const eventPath = process.env.GITHUB_EVENT_PATH;
  if (eventPath) {
    try {
      const eventData = JSON.parse(readFileSync(eventPath, 'utf8'));
      if (eventData.inputs?.branch) {
        return eventData.inputs.branch;
      }
    } catch (error) {
      // Ignore errors reading event file
    }
  }

  // 3. PR head ref
  if (process.env.GITHUB_HEAD_REF) {
    return process.env.GITHUB_HEAD_REF;
  }

  // 4. Current ref name
  if (process.env.GITHUB_REF_NAME) {
    return process.env.GITHUB_REF_NAME;
  }

  throw new Error('Could not determine branch name');
}
