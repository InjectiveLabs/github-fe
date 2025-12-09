/**
 * Test fixtures based on real commit data from InjectiveLabs/injective-helix repository
 * 
 * These fixtures represent actual commits from the master branch to ensure
 * our formatting functions handle real-world data correctly.
 */

export const REPO_URL = 'https://github.com/InjectiveLabs/injective-helix';

/**
 * Individual commits with various patterns
 */
export const COMMITS = {
  // === MERGE COMMITS ===
  
  // Merge from dev to master (most common pattern)
  mergeDevToMaster: {
    hash: 'd01f2f9abc1234567890abcdef1234567890abcd',
    message: 'Merge pull request #2320 from InjectiveLabs/dev',
    authorName: 'ThomasRalee',
    authorEmail: 'thomas.leera@gmail.com',
  },
  
  // Merge feature branch
  mergeFeatureBranch: {
    hash: 'dbb8e54abc1234567890abcdef1234567890abcd',
    message: 'Merge pull request #2303 from InjectiveLabs/feat/megavault',
    authorName: 'ThomasRalee',
    authorEmail: 'thomas.leera@gmail.com',
  },
  
  // Merge fix branch
  mergeFixBranch: {
    hash: '399ef80abc1234567890abcdef1234567890abcd',
    message: 'Merge pull request #2314 from InjectiveLabs/fix/use-default-fee-rates',
    authorName: 'ThomasRalee',
    authorEmail: 'thomas.leera@gmail.com',
  },
  
  // Merge branch into feature (not a PR merge)
  mergeBranchIntoFeature: {
    hash: 'f7d7e35abc1234567890abcdef1234567890abcd',
    message: "Merge branch 'dev' into feat/megavault",
    authorName: '0xA1337',
    authorEmail: 'arthur@injectivelabs.org',
  },
  
  // Merge with long branch name containing Jira ticket
  mergeLongBranchWithJira: {
    hash: '9fadb5c17be12b0234fe344bed0140c2f68dabb3',
    message: 'Merge pull request #2318 from InjectiveLabs/feat/add-support-to-query-seda-pricefeed-for-24/5-markets-IL-2390',
    authorName: 'ThomasRalee',
    authorEmail: 'thomas.leera@gmail.com',
  },

  // === FEATURE COMMITS ===
  
  // Feature with Jira ticket in message
  featWithJira: {
    hash: '5796f4523293b5c8de60c014fb96ba3b2660497f',
    message: 'feat: add support to query seda pricefeed for market is_open for 24/5 markets - IL-2390',
    authorName: 'ThomasRalee',
    authorEmail: 'thomas.leera@gmail.com',
  },
  
  // Feature with long descriptive message
  featLongMessage: {
    hash: 'b243d74abc1234567890abcdef1234567890abcd',
    message: 'feat: add quantization to amount field and update quantity handling',
    authorName: 'ivan-angjelkoski',
    authorEmail: 'ivanangelkoski95@gmail.com',
  },
  
  // Feature with deposit/withdraw flow
  featDepositWithdraw: {
    hash: '0a03b8babc1234567890abcdef1234567890abcd',
    message: 'feat: implement deposit/withdraw flow, improve layout etc',
    authorName: '0xA1337',
    authorEmail: 'arthur@injectivelabs.org',
  },

  // === FIX COMMITS ===
  
  // Fix with special character /
  fixWithSlash: {
    hash: 'ed4a581f3bdf850787af8d8597e3f78a3c60f304',
    message: 'fix: handle edge case of when market oracle base includes /',
    authorName: 'ThomasRalee',
    authorEmail: 'thomas.leera@gmail.com',
  },
  
  // Fix with Jira in parentheses
  fixWithJiraParentheses: {
    hash: 'ca2ca44abc1234567890abcdef1234567890abcd',
    message: 'fix: copy (IL-2360)',
    authorName: 'Frederick-88',
    authorEmail: 'frederickfd88@gmail.com',
  },
  
  // Fix with > character and Jira
  fixWithGreaterThanAndJira: {
    hash: '3fc8ebeabc1234567890abcdef1234567890abcd',
    message: 'fix: trade form > tp sl form issues (IL-2178)',
    authorName: 'Frederick-88',
    authorEmail: 'frederickfd88@gmail.com',
  },
  
  // Fix with long descriptive message
  fixLongMessage: {
    hash: 'c65f530abc1234567890abcdef1234567890abcd',
    message: 'fix: wallet connect modal not visible, hidden behind connect wallet modal - IL-2382',
    authorName: 'ThomasRalee',
    authorEmail: 'thomas.leera@gmail.com',
  },
  
  // Fix with + character
  fixWithPlusSign: {
    hash: 'c0a6df0abc1234567890abcdef1234567890abcd',
    message: 'fix: in partial close position, direct number input + direct submit will pass validation',
    authorName: 'Frederick-88',
    authorEmail: 'frederickfd88@gmail.com',
  },
  
  // Simple fix
  fixSimple: {
    hash: 'c178bb6abc1234567890abcdef1234567890abcd',
    message: 'fix: minor',
    authorName: 'ThomasRalee',
    authorEmail: 'thomas.leera@gmail.com',
  },
  
  // Fix with slippage
  fixSlippage: {
    hash: '7a87e7aabc1234567890abcdef1234567890abcd',
    message: 'fix: stop market slippage warnings',
    authorName: '0xA1337',
    authorEmail: 'arthur@injectivelabs.org',
  },

  // === CHORE COMMITS ===
  
  // Package bump (very common)
  chorePackageBump: {
    hash: '629aaa7abc1234567890abcdef1234567890abcd',
    message: 'chore: package bump',
    authorName: 'ThomasRalee',
    authorEmail: 'ThomasRalee@users.noreply.github.com',
  },
  
  // Chore with comma in message
  choreWithComma: {
    hash: '7e075f2abc1234567890abcdef1234567890abcd',
    message: 'chore: add testnet address, bump packages',
    authorName: '0xA1337',
    authorEmail: 'arthur@injectivelabs.org',
  },
  
  // Chore copy change
  choreCopyChange: {
    hash: 'f09968a6989cd77df646cf0306ae3b5f68b05ce5',
    message: 'chore: copy change',
    authorName: 'ThomasRalee',
    authorEmail: 'thomas.leera@gmail.com',
  },
  
  // Chore minor autosign
  choreMinorAutosign: {
    hash: '90f88cfabc1234567890abcdef1234567890abcd',
    message: 'chore: minor autosign',
    authorName: 'ivan-angjelkoski',
    authorEmail: 'ivanangelkoski95@gmail.com',
  },
  
  // Chore with PR feedback
  chorePrFeedback: {
    hash: 'a7b4be8abc1234567890abcdef1234567890abcd',
    message: 'chore: pr and product feedback',
    authorName: '0xA1337',
    authorEmail: 'arthur@injectivelabs.org',
  },

  // === REFACTOR COMMITS ===
  
  // Refactor with long description
  refactorLong: {
    hash: '6f4c531abc1234567890abcdef1234567890abcd',
    message: 'refactor: use chart code for tvl and pnl charts, remove flickering effect on duration picker',
    authorName: '0xA1337',
    authorEmail: 'arthur@injectivelabs.org',
  },
  
  // Simple refactor
  refactorSimple: {
    hash: 'de1a861abc1234567890abcdef1234567890abcd',
    message: 'refactor: minors',
    authorName: 'Frederick-88',
    authorEmail: 'frederickfd88@gmail.com',
  },
};

/**
 * Authors with different email formats
 */
export const AUTHORS = {
  // Personal Gmail
  thomasPersonal: {
    name: 'ThomasRalee',
    email: 'thomas.leera@gmail.com',
    expectedFormat: '@ThomasRalee',
  },
  
  // GitHub noreply (simple)
  thomasNoreply: {
    name: 'ThomasRalee',
    email: 'ThomasRalee@users.noreply.github.com',
    expectedFormat: '@ThomasRalee',
  },
  
  // Corporate email
  arthurCorporate: {
    name: '0xA1337',
    email: 'arthur@injectivelabs.org',
    expectedFormat: '@0xA1337',
  },
  
  // GitHub noreply (simple) - different user
  arthurNoreply: {
    name: '0xA1337',
    email: '0xA1337@users.noreply.github.com',
    expectedFormat: '@0xA1337',
  },
  
  // GitHub noreply with numeric ID
  ivanNoreplyWithId: {
    name: 'ivan-angjelkoski',
    email: '56976418+ivan-angjelkoski@users.noreply.github.com',
    expectedFormat: '@ivan-angjelkoski',
  },
  
  // Personal Gmail - Ivan
  ivanPersonal: {
    name: 'ivan-angjelkoski',
    email: 'ivanangelkoski95@gmail.com',
    expectedFormat: '@ivan-angjelkoski',
  },
  
  // Personal Gmail - Frederick
  frederickPersonal: {
    name: 'Frederick-88',
    email: 'frederickfd88@gmail.com',
    expectedFormat: '@Frederick-88',
  },
  
  // GitHub noreply - Frederick
  frederickNoreply: {
    name: 'Frederick-88',
    email: 'Frederick-88@users.noreply.github.com',
    expectedFormat: '@Frederick-88',
  },
  
  // Another author - bangjelkoski
  bangjelkoskiNoreply: {
    name: 'bangjelkoski',
    email: 'bangjelkoski@users.noreply.github.com',
    expectedFormat: '@bangjelkoski',
  },
  
  // Personal email - bangjelkoski
  bangjelkoskiPersonal: {
    name: 'bangjelkoski',
    email: 'bangjelkoskii@gmail.com',
    expectedFormat: '@bangjelkoski',
  },
  
  // Full name with spaces (hypothetical for testing)
  fullNameAuthor: {
    name: 'John Doe',
    email: 'john.doe@company.com',
    expectedFormat: 'John Doe (john.doe@company.com)',
  },
};

/**
 * Simulated release scenarios
 * Each scenario represents a typical set of commits that would be deployed together
 */
export const RELEASE_SCENARIOS = {
  // Simple release with a few fixes
  simpleFixRelease: [
    COMMITS.mergeDevToMaster,
    COMMITS.fixSimple,
    COMMITS.chorePackageBump,
  ],
  
  // Feature release with megavault
  featureRelease: [
    COMMITS.mergeFeatureBranch,
    COMMITS.featDepositWithdraw,
    COMMITS.chorePrFeedback,
    COMMITS.chorePackageBump,
  ],
  
  // Mixed release with multiple authors
  mixedAuthorsRelease: [
    COMMITS.mergeDevToMaster,
    COMMITS.fixSlippage,           // 0xA1337
    COMMITS.choreMinorAutosign,    // ivan-angjelkoski
    COMMITS.fixWithPlusSign,       // Frederick-88
    COMMITS.chorePackageBump,      // ThomasRalee
  ],
  
  // Release with Jira tickets
  jiraTicketsRelease: [
    COMMITS.mergeLongBranchWithJira,
    COMMITS.featWithJira,
    COMMITS.fixWithJiraParentheses,
    COMMITS.fixLongMessage,
  ],
  
  // Release with special characters
  specialCharsRelease: [
    COMMITS.fixWithSlash,
    COMMITS.fixWithGreaterThanAndJira,
    COMMITS.fixWithPlusSign,
    COMMITS.choreWithComma,
  ],
  
  // Large release with many commits
  largeRelease: [
    COMMITS.mergeDevToMaster,
    COMMITS.mergeFeatureBranch,
    COMMITS.featWithJira,
    COMMITS.featLongMessage,
    COMMITS.fixWithSlash,
    COMMITS.fixSlippage,
    COMMITS.fixWithPlusSign,
    COMMITS.chorePackageBump,
    COMMITS.choreCopyChange,
    COMMITS.refactorLong,
  ],
};

/**
 * Helper to create a commit object with custom properties
 */
export function createCommit(overrides = {}) {
  return {
    hash: 'abc1234567890abcdef1234567890abcdef123456',
    message: 'test: sample commit message',
    authorName: 'TestAuthor',
    authorEmail: 'test@example.com',
    timestamp: Date.now(),
    ...overrides,
  };
}

/**
 * Generate mock release notes in the format produced by the release-note action
 */
export function generateMockReleaseNotes(commits, repoUrl = REPO_URL) {
  if (!commits || commits.length === 0) {
    return 'No new commits';
  }
  
  return commits.map(commit => {
    const shortHash = commit.hash.substring(0, 7);
    const commitLink = `[${shortHash}](${repoUrl}/commit/${commit.hash})`;
    const prMatch = commit.message.match(/#(\d+)/);
    const prInfo = prMatch ? ` in [#${prMatch[1]}](${repoUrl}/pull/${prMatch[1]})` : '';
    
    // Determine author format
    let author;
    if (commit.authorEmail?.includes('@users.noreply.github.com')) {
      const match = commit.authorEmail.match(/^(?:\d+\+)?([^@]+)@users\.noreply\.github\.com$/i);
      author = match ? `@${match[1]}` : `@${commit.authorName}`;
    } else if (!commit.authorName?.includes(' ')) {
      author = `@${commit.authorName}`;
    } else {
      author = `${commit.authorName} (${commit.authorEmail})`;
    }
    
    return `- ${commitLink} - ${commit.message} by ${author}${prInfo}`;
  }).join('\n');
}
