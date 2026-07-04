# Slack MCP Server Architecture

```text
Claude Desktop / Cursor / Windsurf
        │
        │  HTTP POST /mcp
        │  Authorization: Bearer <MCP_API_KEY>
        ▼
  Express Server
        │
        ├── JSON body parser
        ├── Cookie parser
        ├── Pino HTTP logger
        ├── Rate limiter
        ├── MCP API key middleware
        │
        ▼
   MCP SDK Handler
        │
        ├── slack_list_channels       ─┐
        ├── slack_get_channel_history ─┤
        ├── slack_send_message        ─┤
        ├── slack_get_thread_replies  ─┤──► Slack Web API
        ├── slack_get_user_info       ─┤
        ├── slack_list_users          ─┤
        └── slack_search_messages     ─┘

  OAuth routes
        GET /auth/slack           → Slack install screen
        GET /auth/slack/callback  → token exchange + token storage
        GET /auth/status          → installed workspace summary

  Health
        GET /health               → Slack API + token-store status
```

## Production notes

This starter template uses an in-memory token store to keep the example easy to understand. For production, replace it with Redis, Postgres, DynamoDB, or another durable encrypted token store.

Recommended hardening:

- Store Slack bot tokens encrypted at rest.
- Restrict Slack OAuth scopes to the exact tools you expose.
- Add approval workflows around write tools such as `slack_send_message`.
- Add audit logs for every tool call.
- Use HTTPS for all deployed MCP endpoints.
- Rotate `MCP_API_KEY` regularly.
- Verify the deployed server with MCPForge before exposing it to production AI agents.
