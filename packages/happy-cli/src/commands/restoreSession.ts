/**
 * CLI command: restore a session from the Happy server
 *
 * Usage:
 *   cd packages/happy-cli
 *   tsx src/commands/restoreSession.ts <happy-session-id> [--dry-run] [--verbose]
 *
 * Or via the daemon (once wired up):
 *   happy session restore <happy-session-id>
 */

import { restoreSession, resolveServerUrl, readMasterSecretFromTauri, readTokenFromCLI } from '@/modules/sessionRestore';

async function main() {
    const args = process.argv.slice(2);
    const sessionId = args.find(a => !a.startsWith('--'));
    const dryRun = args.includes('--dry-run');
    const verbose = args.includes('--verbose');

    if (!sessionId) {
        console.error('Usage: tsx src/commands/restoreSession.ts <happy-session-id> [--dry-run] [--verbose]');
        process.exit(1);
    }

    const serverUrl = resolveServerUrl();
    console.log(`Restoring session: ${sessionId}`);
    console.log(`Server: ${serverUrl}`);

    // Resolve credentials
    const tauriCreds = readMasterSecretFromTauri();
    const cliToken = readTokenFromCLI();

    if (!tauriCreds) {
        console.error('ERROR: No master secret found in Tauri localStorage.');
        console.error('The master secret is required to decrypt session data keys.');
        process.exit(1);
    }

    const token = cliToken || tauriCreds.token;
    console.log(`Auth token: ${cliToken ? 'CLI access.key' : 'Tauri localStorage'}`);

    const result = await restoreSession(sessionId, {
        serverUrl,
        token,
        masterSecret: tauriCreds.secret,
        dryRun,
    });

    if (!result.success) {
        console.error(`\nERROR: ${result.error}`);
        process.exit(1);
    }

    console.log(`\nRestored session:`);
    console.log(`  Claude session ID: ${result.claudeSessionId}`);
    console.log(`  Working dir: ${result.workingDir}`);
    console.log(`  Summary: ${result.summary || '(none)'}`);
    console.log(`  Lines: ${result.lineCount}`);
    console.log(`  Path: ${result.jsonlPath}`);

    if (dryRun) {
        console.log(`\n  [DRY RUN] File not written.`);
    } else {
        console.log(`\n  To resume:`);
        console.log(`    cd ${result.workingDir}`);
        console.log(`    claude --resume ${result.claudeSessionId}`);
    }
}

main().catch(e => {
    console.error('Fatal error:', e);
    process.exit(1);
});
