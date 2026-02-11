/**
 * Database Migration Runner
 * 
 * Executes SQL migration files against PostgreSQL.
 * Usage: node migrations/run.js [--seed] [--seed-small]
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const poolConfig = process.env.DATABASE_URL
    ? {
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.DATABASE_URL.includes('sslmode=require')
            ? { rejectUnauthorized: false }
            : false,
    }
    : {
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT, 10) || 5432,
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'gaming_leaderboard',
    };

const pool = new Pool(poolConfig);

const runMigration = async () => {
    const args = process.argv.slice(2);
    const shouldSeed = args.includes('--seed');
    const shouldSeedSmall = args.includes('--seed-small');

    try {
        console.log('═══════════════════════════════════════════════');
        console.log('  Running Database Migrations');
        console.log('═══════════════════════════════════════════════');

        // 1. Run schema migration
        const schemaSQL = fs.readFileSync(
            path.join(__dirname, '001_create_tables.sql'),
            'utf-8'
        );
        await pool.query(schemaSQL);
        console.log('[✓] Schema created (tables + indexes)');

        // 2. Optionally seed data
        if (shouldSeed) {
            console.log('[...] Seeding full dataset (1M users, 5M sessions)...');
            console.log('[...] This may take several minutes...');
            const seedSQL = fs.readFileSync(
                path.join(__dirname, '002_seed_data.sql'),
                'utf-8'
            );
            await pool.query(seedSQL);
            console.log('[✓] Full dataset seeded');
        } else if (shouldSeedSmall) {
            console.log('[...] Seeding small dataset (10K users, 50K sessions)...');
            const seedSQL = fs.readFileSync(
                path.join(__dirname, '002_seed_data_small.sql'),
                'utf-8'
            );
            await pool.query(seedSQL);
            console.log('[✓] Small dataset seeded');
        }

        // 3. Show table stats
        const userCount = await pool.query('SELECT COUNT(*) FROM users');
        const sessionCount = await pool.query('SELECT COUNT(*) FROM game_sessions');
        const leaderboardCount = await pool.query('SELECT COUNT(*) FROM leaderboard');

        console.log('═══════════════════════════════════════════════');
        console.log(`  Users:          ${userCount.rows[0].count}`);
        console.log(`  Game Sessions:  ${sessionCount.rows[0].count}`);
        console.log(`  Leaderboard:    ${leaderboardCount.rows[0].count}`);
        console.log('═══════════════════════════════════════════════');

    } catch (err) {
        console.error('[✗] Migration failed:', err.message);
        process.exit(1);
    } finally {
        await pool.end();
    }
};

runMigration();
