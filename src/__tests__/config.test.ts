import { config } from '../config';

describe('config', () => {
  it('loads and validates configuration from environment variables', () => {
    expect(config.PORT).toBe(3000);
    expect(config.NODE_ENV).toBe('test');
    expect(config.MCP_API_KEY).toBe('test-mcp-api-key-0123456789');
    expect(config.SLACK_CLIENT_ID).toBe('test-slack-client-id');
    expect(config.SLACK_REDIRECT_URI).toBe('http://localhost:3000/auth/slack/callback');
  });

  it('applies defaults for rate limiting', () => {
    expect(config.RATE_LIMIT_WINDOW_MS).toBe(60_000);
    expect(config.RATE_LIMIT_MAX).toBe(100);
  });

  it('leaves the optional static bot token undefined when not set', () => {
    expect(config.SLACK_BOT_TOKEN).toBeUndefined();
  });
});
