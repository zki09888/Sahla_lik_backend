#!/usr/bin/env node
/**
 * scripts/clear-database.js
 *
 * Deletes all rows from every application table while preserving the schema.
 * Auto-increment counters are reset to 1 after each truncation.
 *
 * Usage:
 *   npm run db:clear            # prompts for confirmation
 *   npm run db:clear -- --force # skips the confirmation prompt
 */

const readline = require('readline');
const { query, pool } = require('../src/config/db');

// Tables ordered so that child tables are cleared before their parents,
// avoiding any residual FK constraint violations even with checks disabled.
const TABLES = [
  'service_ratings',
  'app_ratings',
  'tickets',
  'files_attente',
  'rapports',
  'notifications',
  'broadcasts',
  'absence_logs',
  'otp_codes',
  'off_sms',
  'motifs',
  'guichets',
  'statistiques',
  'agences',
  'clients',
  'enterprises',
];

async function confirm(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim().toLowerCase());
    });
  });
}

async function clearDatabase() {
  const force = process.argv.includes('--force');

  if (!force) {
    console.log('⚠️  WARNING: This will permanently delete ALL data from the database.');
    console.log('   Table structure will be preserved, but every row will be removed.\n');

    const answer = await confirm('Type "yes" to continue, anything else to abort: ');

    if (answer !== 'yes') {
      console.log('❌ Aborted. No data was deleted.');
      process.exit(0);
    }

    console.log('');
  }

  try {
    console.log('🔄 Starting database cleanup...\n');

    // Disable FK checks so tables can be cleared in any order without errors.
    await query('SET FOREIGN_KEY_CHECKS = 0');

    for (const table of TABLES) {
      await query(`DELETE FROM \`${table}\``);
      await query(`ALTER TABLE \`${table}\` AUTO_INCREMENT = 1`);
      console.log(`  ✅ Cleared table: ${table}`);
    }

    // Re-enable FK checks.
    await query('SET FOREIGN_KEY_CHECKS = 1');

    console.log(`\n✅ Database cleanup complete! ${TABLES.length} tables cleared.`);
    process.exit(0);
  } catch (err) {
    // Ensure FK checks are always re-enabled even on failure.
    try {
      await query('SET FOREIGN_KEY_CHECKS = 1');
    } catch (_) {
      // ignore secondary error
    }

    console.error('\n❌ Error clearing database:', err.message);
    process.exit(1);
  } finally {
    // Close the connection pool so the process exits cleanly.
    await pool.end().catch(() => {});
  }
}

clearDatabase();
