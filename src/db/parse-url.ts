/**
 * URL parser for connection strings. Re-exported from @easysql/common —
 * the SDK extracted this module from the CLI verbatim, so both share one
 * implementation. Credentials are NEVER persisted.
 */

export { mergeConnection, type ParsedConnection, parseConnectionUrl } from "@easysql/common";
