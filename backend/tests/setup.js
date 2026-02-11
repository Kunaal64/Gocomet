/**
 * Test setup - mock environment
 */

process.env.NODE_ENV = 'test';
process.env.PORT = '0'; // Random port for tests
process.env.DB_HOST = 'localhost';
process.env.DB_PORT = '5432';
process.env.DB_USER = 'postgres';
process.env.DB_PASSWORD = 'password';
process.env.DB_NAME = 'gaming_leaderboard_test';
