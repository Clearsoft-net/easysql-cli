/**
 * Package version — single source of truth, exposed for `easysql --version`
 * and the self-update flow.
 */

import packageJson from "../package.json" with { type: "json" };

export const VERSION: string = packageJson.version;
export const NAME: string = packageJson.name;
export const REPO: string = "Clearsoft-net/easysql-cli";
