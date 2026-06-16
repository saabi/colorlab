import { execSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { arch, platform } from 'node:os';
import path from 'node:path';

const BINDING_VERSION = '1.0.3';
const require = createRequire(path.join(process.cwd(), 'package.json'));

/** Map Node platform/arch to the Rolldown optional native package. */
function bindingPackage() {
	const os = platform();
	const cpu = arch();
	if (os === 'linux' && cpu === 'x64') {
		// Alpine/musl containers set libc differently; default to gnu for WSL/desktop Linux.
		if (process.env.ROLLDOWN_LIBC === 'musl') {
			return '@rolldown/binding-linux-x64-musl';
		}
		return '@rolldown/binding-linux-x64-gnu';
	}
	if (os === 'darwin' && cpu === 'arm64') return '@rolldown/binding-darwin-arm64';
	if (os === 'darwin' && cpu === 'x64') return '@rolldown/binding-darwin-x64';
	if (os === 'win32' && cpu === 'x64') return '@rolldown/binding-win32-x64-msvc';
	return null;
}

const pkg = bindingPackage();
if (!pkg) process.exit(0);

try {
	require.resolve(pkg);
	process.exit(0);
} catch {
	// npm sometimes skips Rolldown's nested optional bindings (npm/cli#4828).
	console.log(`[postinstall] Installing missing native binding ${pkg}@${BINDING_VERSION}`);
	execSync(`npm install --no-save --force ${pkg}@${BINDING_VERSION}`, {
		stdio: 'inherit',
		env: { ...process.env, npm_config_engine_strict: 'false' }
	});
}
