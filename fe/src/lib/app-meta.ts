import pkg from '../../package.json';

/** Application semver from fe/package.json (see RELEASING.md). */
export const APP_VERSION = pkg.version;

export const REPO_URL = 'https://github.com/saabi/colorlab';

/** Full changelog on the default branch. */
export const CHANGELOG_URL = `${REPO_URL}/blob/main/CHANGELOG.md`;
