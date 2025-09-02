const core = require("@actions/core");
const { exec } = require("@actions/exec");

async function run() {
  try {
    const previousTag = core.getInput("previous_tag", { required: true });
    const repoUrl = core.getInput("repo_url", { required: true });

    // Step 1: Increment version
    const newVersion = await incrementVersion(previousTag);
    core.setOutput("new_version", newVersion);

    // Step 2: Generate release notes
    const releaseNotes = await generateReleaseNotes(previousTag, repoUrl);
    core.setOutput("release_notes", releaseNotes);

    // Step 3: Compute Bugsnag app version
    const bugsnagVersion = computeBugsnagVersion(
      newVersion,
      releaseNotes,
      previousTag
    );
    core.setOutput("bugsnag_version", bugsnagVersion);

    console.log(`New version: ${newVersion}`);
    console.log(`Bugsnag version: ${bugsnagVersion}`);
  } catch (error) {
    core.setFailed(error.message);
  }
}

async function incrementVersion(previousTag) {
  // Remove 'v' prefix if present and split the version into major, minor, patch components
  let tagWithoutV = previousTag.startsWith("v")
    ? previousTag.slice(1)
    : previousTag;
  const versionParts = tagWithoutV.split(".");

  // Validate that we have all three components
  if (
    versionParts.length !== 3 ||
    versionParts.some((part) => !part || isNaN(part))
  ) {
    throw new Error("Invalid tag format. Expected format: v1.2.3 or 1.2.3");
  }

  const [major, minor, patch] = versionParts.map(Number);

  // Increment the patch number
  const newPatch = patch + 1;
  return `v${major}.${minor}.${newPatch}`;
}

async function generateReleaseNotes(previousTag, repoUrl) {
  // Validate that the previous tag exists
  try {
    await exec("git", ["rev-parse", "--verify", previousTag], { silent: true });
  } catch (error) {
    throw new Error(`Tag '${previousTag}' does not exist`);
  }

  // Debug: Show current HEAD and tag info
  console.log(`Previous tag: ${previousTag}`);

  let currentHead;
  await exec("git", ["rev-parse", "HEAD"], {
    listeners: {
      stdout: (data) => {
        currentHead = data.toString().trim();
      },
    },
  });
  console.log(`Current HEAD: ${currentHead}`);

  let tagCommit;
  await exec("git", ["rev-parse", previousTag], {
    listeners: {
      stdout: (data) => {
        tagCommit = data.toString().trim();
      },
    },
  });
  console.log(`Tag commit: ${tagCommit}`);

  // Check if there are any commits between the previous tag and HEAD
  let commitCount = 0;
  try {
    await exec("git", ["rev-list", "--count", `${previousTag}..HEAD`], {
      listeners: {
        stdout: (data) => {
          commitCount = parseInt(data.toString().trim());
        },
      },
    });
  } catch (error) {
    commitCount = 0;
  }

  if (commitCount === 0) {
    console.log(`No commits found between ${previousTag} and HEAD.`);
    return "No new commits";
  }

  console.log(`Found ${commitCount} commits between ${previousTag} and HEAD`);

  // Get all commits in the range (excluding merge commits for cleaner output)
  let allCommits = "";
  try {
    await exec(
      "git",
      [
        "log",
        `${previousTag}..HEAD`,
        "--no-merges",
        "--pretty=format:%H|%s|%an|%ae",
      ],
      {
        listeners: {
          stdout: (data) => {
            allCommits += data.toString();
          },
        },
      }
    );
  } catch (error) {
    console.log("No commits found in the specified range");
    return "No new commits";
  }

  // Debug: Show raw commit data
  console.log("Raw commits found:");
  console.log(allCommits.split("\n").slice(0, 10).join("\n"));

  if (!allCommits.trim()) {
    return "No new commits";
  }

  const formattedNotes = [];
  const commitLines = allCommits.trim().split("\n");

  for (const line of commitLines) {
    if (!line.trim()) continue;

    const [commitHash, commitMessage, commitAuthor, commitEmail] =
      line.split("|");

    if (!commitHash || !commitMessage) continue;

    // Clean up commit message (escape backticks and quotes)
    const cleanMessage = commitMessage
      .replace(/`/g, "\\`")
      .replace(/"/g, '\\"');

    // Format author
    let githubAuthor;
    if (commitAuthor.includes(" ")) {
      githubAuthor = `${commitAuthor} (${commitEmail})`;
    } else {
      githubAuthor = `@${commitAuthor}`;
    }

    // Check if this commit message contains a PR number
    const prMatch = commitMessage.match(/#(\d+)/);
    let prInfo = "";
    if (prMatch) {
      const prNumber = prMatch[1];
      const prLink = `[#${prNumber}](${repoUrl}/pull/${prNumber})`;
      prInfo = ` in ${prLink}`;
    }

    // Add to formatted notes
    formattedNotes.push(
      `- ${commitHash.substring(
        0,
        7
      )} - ${cleanMessage} by ${githubAuthor}${prInfo}`
    );
  }

  return formattedNotes.length > 0
    ? formattedNotes.join("\n")
    : "No new commits";
}

function computeBugsnagVersion(newVersion, releaseNotes, previousTag) {
  // Initialize app_version with new_version
  let appVersion = newVersion;

  // Conditional assignment based on release_notes output
  if (releaseNotes === "No new commits") {
    appVersion = previousTag;
  }

  return appVersion;
}

// Run the action
run();
