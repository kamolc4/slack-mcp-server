# Slack MCP Server

[![CI](https://github.com/kamolc4/slack-mcp-server/actions/workflows/ci.yml/badge.svg)](https://github.com/kamolc4/slack-mcp-server/actions/workflows/ci.yml)
[![Verified by MCPForge](https://www.mcpforge.tech/api/servers/slack-mcp-server/badge)](https://www.mcpforge.tech/verified/slack-mcp-server)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

A production-ready Model Context Protocol server for the Slack API.

This template lets Claude Desktop, Cursor, Windsurf, and other MCP-compatible clients search Slack, list channels, read recent channel history, inspect users, fetch thread replies, and send messages through controlled Slack tools.

Built as a starter template for teams that want a secure baseline before adding company-specific Slack automation workflows.

## Who this is for

This repository is useful for:

- developers building AI assistants for Slack workspaces,
- internal tools teams connecting Slack to AI agents,
- platform engineers who need a clean TypeScript MCP server example,
- agencies building Slack automation for clients,
- teams that want controlled Slack read/write tools for Claude, Cursor, or other MCP clients.

## Features

- TypeScript + Express MCP server
- Slack OAuth 2.0 installation flow
- Optional static bot token bootstrap with `SLACK_BOT_TOKEN`
- Bearer-token protection for `/mcp`
- Rate limiting for MCP requests
- Health endpoint at `/health`
- Structured Pino logging
- Zod-based environment validation
- MCP tools for channels, messages, threads, users, and search
- Jest + Supertest test setup
- GitHub Actions CI workflow

## Architecture

```text
Claude Desktop / Cursor / Windsurf
        │
        │  HTTP POST /mcp
        │  Authorization: Bearer <MCP_API_KEY>
        ▼
  Express Server
        │
        ├── Pino HTTP logger
        ├── Rate limiter
        ├── MCP API key middleware
        │
        ▼
   MCP SDK Handler
        │
        ├── slack_list_channels       ─┐
        ├── slack_get_channel_history ─┤
        ├── slack_send_message        ─┤──► Slack Web API
        ├── slack_get_thread_replies  ─┤
        ├── slack_get_user_info       ─┤
        ├── slack_list_users          ─┤
        └── slack_search_messages     ─┘

  OAuth Flow
        GET /auth/slack           → Slack install screen
        GET /auth/slack/callback  → token exchange + token storage
        GET /auth/status          → installed workspace summary

  GET /health → Slack API + token-store dependency status
```

See the larger diagram in [docs/architecture.md](docs/architecture.md).

## Source Code

The complete production-ready Slack MCP Server template is available on GitHub.

Repository:

https://github.com/kamolc4/slack-mcp-server

The repository includes:

- Complete TypeScript source code
- Slack OAuth implementation
- MCP tools
- GitHub Actions CI
- Jest test suite
- MIT License
- Claude Desktop & Cursor configuration
- Production deployment examples

Fork the repository or download it as a ZIP to start building immediately.

## Available MCP tools

| Tool | Purpose |
|---|---|
| `slack_list_channels` | List public and private channels in the connected Slack workspace. |
| `slack_get_channel_history` | Fetch recent messages from a Slack channel. |
| `slack_send_message` | Post a message to a channel, optionally as a thread reply. |
| `slack_get_thread_replies` | Fetch replies in a Slack message thread. |
| `slack_get_user_info` | Get profile details for a Slack user by ID. |
| `slack_list_users` | List workspace users. |
| `slack_search_messages` | Search Slack messages using Slack search syntax. |

## Quick start

### 1. Install dependencies

```bash
# Clone repository
git clone https://github.com/kamolc4/slack-mcp-server.git

cd slack-mcp-server

# Install dependencies
npm ci
```

### 2. Configure environment

```bash
cp .env.example .env
```

Edit `.env`:

```bash
PORT=3000
NODE_ENV=development
LOG_LEVEL=info
BASE_URL=http://localhost:3000

MCP_API_KEY=replace-with-a-long-random-secret
SESSION_SECRET=replace-with-a-long-random-session-secret

SLACK_CLIENT_ID=your-slack-client-id
SLACK_CLIENT_SECRET=your-slack-client-secret
SLACK_SIGNING_SECRET=your-slack-signing-secret
SLACK_REDIRECT_URI=http://localhost:3000/auth/slack/callback

RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX=100
```

### 3. Run locally

```bash
npm run dev
```

### 4. Install the Slack app

Open this URL in your browser:

```text
http://localhost:3000/auth/slack
```

After successful installation, check status:

```bash
curl http://localhost:3000/auth/status
```

### 5. Check health

```bash
curl http://localhost:3000/health
```

## Slack OAuth setup

In the Slack API dashboard:

1. Create a new Slack app.
2. Add this redirect URL:

```text
http://localhost:3000/auth/slack/callback
```

3. Copy the client ID, client secret, and signing secret into `.env`.
4. Add the OAuth scopes required by the tools you expose.

Recommended bot scopes for this starter template:

```text
channels:read
channels:history
users:read
search:read
chat:write
```

For production, set `SLACK_REDIRECT_URI` to your deployed callback URL, for example:

```text
https://your-domain.com/auth/slack/callback
```

## Optional static bot token mode

For local single-workspace testing, you can skip OAuth and use an existing bot token:

```bash
SLACK_BOT_TOKEN=xoxb-your-token
```

The server will call `auth.test` at startup and bootstrap the token if it is valid.

## Connect to Claude Desktop

Build the server first:

```bash
npm run build
npm start
```

Then add an MCP server entry in your Claude Desktop configuration:

```json
{
  "mcpServers": {
    "slack": {
      "url": "http://localhost:3000/mcp",
      "headers": {
        "Authorization": "Bearer replace-with-your-mcp-api-key"
      }
    }
  }
}
```

Restart Claude Desktop after editing the configuration.

## Connect to Cursor

In Cursor, add a new MCP server using the HTTP endpoint:

```json
{
  "name": "slack",
  "url": "http://localhost:3000/mcp",
  "headers": {
    "Authorization": "Bearer replace-with-your-mcp-api-key"
  }
}
```

Then restart Cursor or reload the MCP server list.

## Security notes

This template is safer than a minimal demo, but you should harden it before production use.

Recommended production changes:

- Replace the in-memory token store in `src/auth.ts` with Redis, Postgres, or another encrypted durable store.
- Store Slack bot tokens encrypted at rest.
- Store secrets in a managed secret manager, not in plain `.env` files.
- Rotate `MCP_API_KEY` regularly.
- Add per-user or per-workspace authorization if multiple users will access the server.
- Restrict write tools such as `slack_send_message` behind approvals.
- Add audit logs for every tool call.
- Use HTTPS in production.
- Review Slack scopes and remove anything your use case does not need.

## Security Review

Verify this server with MCPForge:

https://www.mcpforge.tech/verify

MCPForge can help review:

- exposed tools,
- authentication behavior,
- health checks,
- compatibility with MCP clients,
- risk level of write operations,
- security posture before publishing or deployment.

After verification, you can link your public report from this README:

```md
[![Verified by MCPForge](https://www.mcpforge.tech/api/servers/slack-mcp-server/badge)](https://www.mcpforge.tech/verified/slack-mcp-server)
```

Read the complete guide on MCPForge:

https://www.mcpforge.tech/blog/slack-mcp-server

## Deployment

A common production setup:

1. Deploy this service to Railway, Render, Fly.io, AWS, GCP, Azure, or a private Kubernetes cluster.
2. Configure environment variables in the hosting provider.
3. Set `BASE_URL` to your public HTTPS URL.
4. Set `SLACK_REDIRECT_URI` to `https://your-domain.com/auth/slack/callback`.
5. Add the same callback URL in the Slack app dashboard.
6. Run the Slack OAuth installation flow once to connect the workspace.
7. Verify `/health` and `/mcp` before connecting production AI clients.
8. Run a public or private verification with MCPForge.

## Local development commands

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

## API endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/health` | Health and Slack connectivity check. |
| `GET` | `/auth/slack` | Start Slack OAuth installation. |
| `GET` | `/auth/slack/callback` | Slack OAuth callback. |
| `GET` | `/auth/status` | Installed workspace status. |
| `POST` | `/mcp` | MCP endpoint protected by `Authorization: Bearer <MCP_API_KEY>`. |

## Contributing

Contributions are welcome.

To improve this Slack MCP Server template, please open an issue or submit a pull request.

## Releases

Latest stable release:

v1.0.0

See the Releases page for the full changelog.

## License

MIT — see [LICENSE](LICENSE).

## Related MCP Server Templates

Looking for other production-ready MCP Server templates?

- GitHub MCP Server
- Slack MCP Server
- Stripe MCP Server
- Notion MCP Server
- Shopify MCP Server
- HubSpot MCP Server
- PostgreSQL MCP Server

Browse the complete collection:

https://www.mcpforge.tech/code
