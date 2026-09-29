/**
 * OS keyring storage for local database passwords.
 *
 * The "credentials never leave the host" rule is about the API: only the
 * schema is sent to EasySQL. On the client machine the password MAY be
 * persisted — opt-in via `connector add/sync --save-password` — and this
 * module stores it in the native credential store of the OS:
 *
 *   darwin  /usr/bin/security   (macOS Keychain)
 *   linux   secret-tool         (libsecret: GNOME Keyring / KDE Wallet)
 *   win32   powershell.exe      (Windows Credential Manager)
 *
 * Everything is plain shell-out (`node:child_process`) — no native `.node`
 * addons — so the same code runs under Node, Bun and the `bun build
 * --compile` standalone binary. Reads return `null` on ANY failure (tool
 * missing, keyring locked, no D-Bus session) so callers degrade to the
 * prompt; set `EASYSQL_KEYRING=0` to disable the keyring entirely.
 */

import { execFile } from "node:child_process";
import { platform } from "node:os";

export const KEYRING_SERVICE = "easysql";

/** Generous: macOS may show an ACL dialog the first time an item is read. */
const OP_TIMEOUT_MS = 20_000;

export type KeyringBackend = "security" | "secret-tool" | "powershell" | "disabled";

export interface RunResult {
	code: number;
	stdout: string;
	stderr: string;
}

export type Runner = (file: string, args: string[], stdin?: string) => Promise<RunResult>;

type Action = "get" | "set" | "delete";

export function backendFor(
	platformName: string,
	env: Record<string, string | undefined> = process.env,
): KeyringBackend {
	if (env.EASYSQL_KEYRING === "0") return "disabled";
	switch (platformName) {
		case "darwin":
			return "security";
		case "win32":
			return "powershell";
		case "linux":
			return "secret-tool";
		default:
			return "disabled";
	}
}

function execRunner(file: string, args: string[], stdin?: string): Promise<RunResult> {
	return new Promise((resolve) => {
		const child = execFile(
			file,
			args,
			{
				timeout: OP_TIMEOUT_MS,
				killSignal: "SIGKILL",
				windowsHide: true,
				maxBuffer: 1 << 20,
			},
			(error, stdout, stderr) => {
				const code =
					error === null
						? 0
						: error.code === "ENOENT"
							? 127
							: typeof error.code === "number"
								? error.code
								: 1;
				resolve({
					code,
					stdout: String(stdout ?? ""),
					stderr: String(stderr ?? error?.message ?? ""),
				});
			},
		);
		child.on("error", (error) => {
			resolve({ code: 127, stdout: "", stderr: error.message });
		});
		if (stdin !== undefined) {
			child.stdin?.on("error", () => {
				// EPIPE when the tool exits before reading stdin — the exit code decides.
			});
			child.stdin?.end(stdin);
		}
	});
}

/**
 * Windows Credential Manager via inline PowerShell (CredRead/CredWrite).
 * The payload travels base64-encoded on stdin and the secret comes back the
 * same way: it never touches argv, and base64 keeps PowerShell's console
 * encoding from mangling non-ASCII passwords.
 */
const POWERSHELL_SCRIPT = `
$ErrorActionPreference = 'Stop'
$raw = [Console]::In.ReadToEnd().Trim()
$payload = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($raw))
$p = $payload | ConvertFrom-Json
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
[StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
public struct EasySqlCredential {
	public int Flags;
	public int Type;
	public string TargetName;
	public string Comment;
	public long LastWritten;
	public int CredentialBlobSize;
	public IntPtr CredentialBlob;
	public int Persist;
	public int AttributeCount;
	public IntPtr Attributes;
	public string TargetAlias;
	public string UserName;
}
public static class EasySqlCred {
	[DllImport("advapi32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
	public static extern bool CredWrite(ref EasySqlCredential cred, int flags);
	[DllImport("advapi32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
	public static extern bool CredRead(string target, int type, int flags, out IntPtr cred);
	[DllImport("advapi32.dll")]
	public static extern void CredFree(IntPtr buffer);
	[DllImport("advapi32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
	public static extern bool CredDelete(string target, int type, int flags);
}
'@
$target = 'easysql/' + $p.account
switch ($p.op) {
	'set' {
		$bytes = [Text.Encoding]::UTF8.GetBytes($p.secret)
		$pin = [Runtime.InteropServices.GCHandle]::Alloc($bytes, 'Pinned')
		$c = New-Object EasySqlCredential
		$c.Type = 1
		$c.TargetName = $target
		$c.CredentialBlobSize = $bytes.Length
		$c.CredentialBlob = $pin.AddrOfPinnedObject()
		$c.Persist = 2
		$c.UserName = 'easysql'
		$ok = [EasySqlCred]::CredWrite([ref]$c, 0)
		$pin.Free()
		if (-not $ok) { exit 1 }
	}
	'get' {
		$ptr = [IntPtr]::Zero
		if (-not [EasySqlCred]::CredRead($target, 1, 0, [ref]$ptr)) { exit 1 }
		$c = [Runtime.InteropServices.Marshal]::PtrToStructure($ptr, [type][EasySqlCredential])
		$arr = New-Object byte[] $c.CredentialBlobSize
		if ($c.CredentialBlobSize -gt 0) {
			[Runtime.InteropServices.Marshal]::Copy($c.CredentialBlob, $arr, 0, $c.CredentialBlobSize)
		}
		[EasySqlCred]::CredFree($ptr)
		[Console]::Out.WriteLine([Convert]::ToBase64String($arr))
	}
	'delete' {
		if (-not [EasySqlCred]::CredDelete($target, 1, 0)) { exit 1 }
	}
}
`.trim();

function encodePayload(action: Action, account: string, secret?: string): string {
	return Buffer.from(
		JSON.stringify({ op: action, account, secret: secret ?? "" }),
		"utf8",
	).toString("base64");
}

let runner: Runner = execRunner;
let currentPlatform: () => string = platform;

/** Test hooks: inject a fake runner/platform (pass null to restore). */
export function __setTestHooks(hooks: { runner?: Runner | null; platform?: string | null }): void {
	if (hooks.runner !== undefined) runner = hooks.runner ?? execRunner;
	if (hooks.platform !== undefined) {
		const fixed = hooks.platform;
		currentPlatform = fixed === null ? platform : () => fixed;
	}
}

function disabledReason(env: Record<string, string | undefined> = process.env): string {
	return env.EASYSQL_KEYRING === "0"
		? "OS keyring disabled via EASYSQL_KEYRING=0"
		: "no OS keyring support on this platform";
}

async function perform(action: Action, account: string, secret?: string): Promise<RunResult> {
	const backend = backendFor(currentPlatform());
	if (backend === "disabled") {
		return { code: 1, stdout: "", stderr: disabledReason() };
	}
	switch (backend) {
		case "security": {
			// `security` only accepts the secret as `-w` argv — the same
			// trade-off gh's keyring (zalando/go-keyring) makes on macOS.
			if (action === "set") {
				return runner("/usr/bin/security", [
					"add-generic-password",
					"-a",
					account,
					"-s",
					KEYRING_SERVICE,
					"-w",
					secret ?? "",
					"-U",
				]);
			}
			if (action === "get") {
				return runner("/usr/bin/security", [
					"find-generic-password",
					"-a",
					account,
					"-s",
					KEYRING_SERVICE,
					"-w",
				]);
			}
			return runner("/usr/bin/security", [
				"delete-generic-password",
				"-a",
				account,
				"-s",
				KEYRING_SERVICE,
			]);
		}
		case "secret-tool": {
			// libsecret reads the secret from stdin — never from argv.
			if (action === "set") {
				return runner(
					"secret-tool",
					[
						"store",
						"--label",
						`EasySQL ${account}`,
						"account",
						account,
						"service",
						KEYRING_SERVICE,
					],
					secret ?? "",
				);
			}
			if (action === "get") {
				return runner("secret-tool", [
					"lookup",
					"account",
					account,
					"service",
					KEYRING_SERVICE,
				]);
			}
			return runner("secret-tool", ["clear", "account", account, "service", KEYRING_SERVICE]);
		}
		case "powershell":
			return runner(
				"powershell.exe",
				["-NoProfile", "-NonInteractive", "-Command", POWERSHELL_SCRIPT],
				encodePayload(action, account, secret),
			);
	}
}

/** Reads a stored password; `null` when absent or the keyring is unusable. */
export async function keyringGet(account: string): Promise<string | null> {
	const backend = backendFor(currentPlatform());
	const res = await perform("get", account);
	if (res.code !== 0) return null;
	if (backend === "powershell") {
		const b64 = res.stdout.trim();
		if (!b64) return null;
		return Buffer.from(b64, "base64").toString("utf8") || null;
	}
	const out = res.stdout.replace(/\r?\n$/, "");
	return out.length > 0 ? out : null;
}

/** Stores a password. Throws when the backend fails or is unavailable. */
export async function keyringSet(account: string, secret: string): Promise<void> {
	const backend = backendFor(currentPlatform());
	const res = await perform("set", account, secret);
	if (res.code === 0) return;
	if (res.code === 127) {
		throw new Error(`${backend} not found — the OS keyring is unavailable on this system`);
	}
	throw new Error(res.stderr.trim() || `keyring backend exited with code ${res.code}`);
}

/** Best-effort removal (missing entries are not an error). */
export async function keyringDelete(account: string): Promise<void> {
	await perform("delete", account);
}
