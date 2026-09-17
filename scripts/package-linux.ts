/**
 * Package the standalone Linux binary as a .deb or .rpm, so `easysql` can be
 * installed with `dpkg -i` / `apt install ./easysql.deb` or `rpm -i` /
 * `dnf install ./easysql.rpm`.
 *
 *   bun run scripts/package-linux.ts --format deb [--arch x64|arm64]
 *   bun run scripts/package-linux.ts --format rpm [--arch x64|arm64]
 *
 * Reuses `bin/easysql-linux-<arch>` when present, otherwise compiles it with
 * `bun build --compile`. Requires `dpkg-deb` (deb) or `rpmbuild` (rpm).
 */

import { spawnSync } from "node:child_process";
import {
	chmodSync,
	copyFileSync,
	existsSync,
	mkdirSync,
	readdirSync,
	readFileSync,
	rmSync,
	statSync,
	writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as {
	name: string;
	version: string;
	license: string;
};

const args = process.argv.slice(2);
function flag(name: string): string | undefined {
	const i = args.indexOf(name);
	return i >= 0 ? args[i + 1] : undefined;
}

function hostArch(): string {
	return process.arch === "arm64" ? "arm64" : "x64";
}

const format = flag("--format") ?? "deb";
const arch = (flag("--arch") ?? hostArch()) as "x64" | "arm64";
const outDir = join(root, flag("--out") ?? "bin");
const maintainer = process.env.MAINTAINER ?? "Clearsoft <contato@clearsoft.net>";
const homepage = "https://easysql.net";
const summary = "Natural-language queries over local MySQL, PostgreSQL and SQLite databases";
const description = [
	"Official command-line interface for the EasySQL API. It introspects the local",
	"database schema (credentials never leave the machine), turns natural-language",
	"questions into SELECT-only SQL and executes it locally.",
];

if (format !== "deb" && format !== "rpm") {
	console.error(`Unknown format: ${format} (expected "deb" or "rpm")`);
	process.exit(1);
}
if (arch !== "x64" && arch !== "arm64") {
	console.error(`Unknown arch: ${arch} (expected "x64" or "arm64")`);
	process.exit(1);
}

function run(cmd: string, cmdArgs: string[], cwd = root) {
	console.log(`→ ${cmd} ${cmdArgs.join(" ")}`);
	const r = spawnSync(cmd, cmdArgs, { cwd, stdio: "inherit" });
	if (r.error) {
		console.error(`\nFailed to run "${cmd}": ${r.error.message}`);
		process.exit(1);
	}
	if (r.status !== 0) process.exit(r.status ?? 1);
}

function ensureBinary(): string {
	const bin = join(outDir, `easysql-linux-${arch}`);
	if (!existsSync(bin)) {
		mkdirSync(outDir, { recursive: true });
		run("bun", [
			"build",
			"--compile",
			"--minify",
			`--target=bun-linux-${arch}`,
			"--outfile",
			bin,
			join(root, "src/bin.ts"),
		]);
	}
	return bin;
}

function dirSize(dir: string): number {
	let total = 0;
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		const path = join(dir, entry.name);
		if (entry.isDirectory()) total += dirSize(path);
		else if (entry.isFile()) total += statSync(path).size;
	}
	return total;
}

function debArch(): string {
	return arch === "x64" ? "amd64" : "arm64";
}

function rpmArch(): string {
	return arch === "x64" ? "x86_64" : "aarch64";
}

// Debian treats "~" as sorting before anything, mapping semver prereleases
// (0.4.0-rc.1) to the pre-release slot instead of the Debian revision.
function debVersion(): string {
	return pkg.version.replace(/-/g, "~");
}

// RPM forbids "-" in Version (it separates Version from Release), so the
// semver prerelease moves into the Release field.
function rpmVersionRelease(): { version: string; release: string } {
	const [version = pkg.version, ...pre] = pkg.version.split("-");
	return { version, release: pre.length ? `0.1.${pre.join(".")}` : "1" };
}

function changelogDate(): string {
	const d = new Date();
	const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
	const months = [
		"Jan",
		"Feb",
		"Mar",
		"Apr",
		"May",
		"Jun",
		"Jul",
		"Aug",
		"Sep",
		"Oct",
		"Nov",
		"Dec",
	];
	const day = String(d.getUTCDate()).padStart(2, " ");
	return `${days[d.getUTCDay()]} ${months[d.getUTCMonth()]} ${day} ${d.getUTCFullYear()}`;
}

function buildDeb(binary: string): void {
	const stage = join(outDir, ".pkg-deb");
	if (existsSync(stage)) rmSync(stage, { recursive: true, force: true });
	mkdirSync(join(stage, "usr", "bin"), { recursive: true });
	mkdirSync(join(stage, "usr", "share", "doc", "easysql"), { recursive: true });
	mkdirSync(join(stage, "DEBIAN"), { recursive: true });

	const target = join(stage, "usr", "bin", "easysql");
	copyFileSync(binary, target);
	chmodSync(target, 0o755);
	copyFileSync(join(root, "LICENSE"), join(stage, "usr", "share", "doc", "easysql", "copyright"));

	const installedKb = Math.ceil(dirSize(stage) / 1024);
	const control = [
		"Package: easysql",
		`Version: ${debVersion()}`,
		"Section: utils",
		"Priority: optional",
		`Architecture: ${debArch()}`,
		`Maintainer: ${maintainer}`,
		`Installed-Size: ${installedKb}`,
		`Homepage: ${homepage}`,
		`Description: ${summary}`,
		...description.map((line) => ` ${line}`),
		"",
	].join("\n");
	writeFileSync(join(stage, "DEBIAN", "control"), control);

	const out = join(outDir, `easysql_${debVersion()}_${debArch()}.deb`);
	run("dpkg-deb", ["--build", "--root-owner-group", stage, out]);
	rmSync(stage, { recursive: true, force: true });
	console.log(`✓ ${out.replace(`${root}/`, "")}`);
}

function buildRpm(binary: string): void {
	const top = join(outDir, ".pkg-rpm");
	if (existsSync(top)) rmSync(top, { recursive: true, force: true });
	for (const d of ["BUILD", "RPMS", "SOURCES", "SPECS", "SRPMS"]) {
		mkdirSync(join(top, d), { recursive: true });
	}

	const source = join(top, "SOURCES", "easysql");
	copyFileSync(binary, source);
	chmodSync(source, 0o755);

	const { version, release } = rpmVersionRelease();
	const spec = `# Disable the RPM post-install helpers: they run the host's strip(1)
# against the buildroot, which mangles cross-architecture Bun binaries.
%global __os_install_post %{nil}

Name:           easysql
Version:        ${version}
Release:        ${release}%{?dist}
Summary:        ${summary}
License:        ${pkg.license}
URL:            ${homepage}
BuildArch:      ${rpmArch()}

%description
${description.join("\n")}

%install
mkdir -p %{buildroot}%{_bindir}
install -m 0755 %{_sourcedir}/easysql %{buildroot}%{_bindir}/easysql

%files
%{_bindir}/easysql

%changelog
* ${changelogDate()} ${maintainer} - ${version}-${release}
- Automated package of easysql ${pkg.version}
`;
	writeFileSync(join(top, "SPECS", "easysql.spec"), spec);

	run("rpmbuild", [
		"-bb",
		"--define",
		`_topdir ${top}`,
		"--define",
		`_sourcedir ${join(top, "SOURCES")}`,
		join(top, "SPECS", "easysql.spec"),
	]);

	const rpmsDir = join(top, "RPMS", rpmArch());
	const file = readdirSync(rpmsDir).find((f) => f.endsWith(".rpm"));
	if (!file) {
		console.error(`\nNo .rpm produced in ${rpmsDir}`);
		process.exit(1);
	}
	const out = join(outDir, file);
	copyFileSync(join(rpmsDir, file), out);
	rmSync(top, { recursive: true, force: true });
	console.log(`✓ ${out.replace(`${root}/`, "")}`);
}

const binary = ensureBinary();
if (format === "deb") buildDeb(binary);
else buildRpm(binary);
