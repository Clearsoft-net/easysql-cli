/**
 * Public entrypoint — re-exports version metadata, errors, and the
 * message catalog. The binary entry is `src/cli.ts`.
 */

export { ApiError, CliError, NetworkError, NotLoggedInError } from "./cli/errors.js";
export type { Locale } from "./i18n/messages.js";
export { MESSAGES, t } from "./i18n/messages.js";
export { NAME, REPO, VERSION } from "./version.js";
