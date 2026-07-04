/**
 * Global Jest setup file.
 *
 * Runs once per test file, BEFORE the test framework and any test modules
 * are loaded (see jest.config.ts -> setupFiles).
 *
 * src/config.ts calls loadConfig() at import time and throws if required
 * env vars are missing, so every var it validates must be defined here —
 * otherwise importing anything that transitively pulls in ./config
 * (auth, logger, health, tools/*, server) blows up before a single test runs.
 */

process.env['NODE_ENV'] = 'test';
process.env['PORT'] = '3000';
process.env['LOG_LEVEL'] = 'silent';
process.env['BASE_URL'] = 'http://localhost:3000';

process.env['SLACK_CLIENT_ID'] = 'test-slack-client-id';
process.env['SLACK_CLIENT_SECRET'] = 'test-slack-client-secret';
process.env['SLACK_SIGNING_SECRET'] = 'test-slack-signing-secret';
process.env['SLACK_REDIRECT_URI'] = 'http://localhost:3000/auth/slack/callback';
// SLACK_BOT_TOKEN is intentionally left unset — it's optional in config.ts

process.env['MCP_API_KEY'] = 'test-mcp-api-key-0123456789';
process.env['SESSION_SECRET'] = 'test-session-secret-0123456789';

process.env['RATE_LIMIT_WINDOW_MS'] = '60000';
process.env['RATE_LIMIT_MAX'] = '100';
