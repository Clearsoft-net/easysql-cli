#!/usr/bin/env bun
/**
 * CLI entrypoint — wired in Commit 2.
 * For now this prints a placeholder so the build pipeline can be validated.
 */

import { VERSION } from "./version.js";

console.log(`easysql ${VERSION}`);
console.log("CLI bootstrap complete — commands arrive in subsequent commits.");
