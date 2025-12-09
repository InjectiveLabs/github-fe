/**
 * Version utilities for GitHub Actions
 * Handles semantic versioning operations
 */

/**
 * Parse a semantic version string into components
 * 
 * @param {string} version - Version string (e.g., "v1.2.3" or "1.2.3")
 * @returns {Object} - Parsed version { major, minor, patch, prefix }
 * @throws {Error} - If version format is invalid
 */
export function parseVersion(version) {
  if (!version) {
    throw new Error('Version string is required');
  }
  
  // Check for 'v' prefix
  const hasPrefix = version.startsWith('v');
  const versionWithoutPrefix = hasPrefix ? version.slice(1) : version;
  
  const parts = versionWithoutPrefix.split('.');
  
  if (parts.length !== 3) {
    throw new Error(`Invalid version format: ${version}. Expected format: v1.2.3 or 1.2.3`);
  }
  
  const [majorStr, minorStr, patchStr] = parts;
  const major = parseInt(majorStr, 10);
  const minor = parseInt(minorStr, 10);
  const patch = parseInt(patchStr, 10);
  
  if (isNaN(major) || isNaN(minor) || isNaN(patch)) {
    throw new Error(`Invalid version format: ${version}. Version components must be numbers`);
  }
  
  if (major < 0 || minor < 0 || patch < 0) {
    throw new Error(`Invalid version format: ${version}. Version components must be non-negative`);
  }
  
  return { major, minor, patch, prefix: hasPrefix ? 'v' : '' };
}

/**
 * Increment the patch version
 * 
 * @param {string} version - Current version string
 * @returns {string} - Incremented version string (always with 'v' prefix)
 */
export function incrementPatch(version) {
  const { major, minor, patch } = parseVersion(version);
  return `v${major}.${minor}.${patch + 1}`;
}

/**
 * Increment the minor version (resets patch to 0)
 * 
 * @param {string} version - Current version string
 * @returns {string} - Incremented version string (always with 'v' prefix)
 */
export function incrementMinor(version) {
  const { major, minor } = parseVersion(version);
  return `v${major}.${minor + 1}.0`;
}

/**
 * Increment the major version (resets minor and patch to 0)
 * 
 * @param {string} version - Current version string
 * @returns {string} - Incremented version string (always with 'v' prefix)
 */
export function incrementMajor(version) {
  const { major } = parseVersion(version);
  return `v${major + 1}.0.0`;
}

/**
 * Format version object back to string
 * 
 * @param {Object} version - Version object { major, minor, patch }
 * @param {boolean} withPrefix - Whether to include 'v' prefix (default: true)
 * @returns {string} - Formatted version string
 */
export function formatVersion({ major, minor, patch }, withPrefix = true) {
  const prefix = withPrefix ? 'v' : '';
  return `${prefix}${major}.${minor}.${patch}`;
}
