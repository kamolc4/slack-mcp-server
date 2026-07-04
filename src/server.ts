import express from 'express';
import cookieParser from 'cookie-parser';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import rateLimit from 'express-rate-limit';
import { WebClient } from '@slack/web-api';
import { v4 as uuidv4 } from 'uuid';

import { config } from './config';
import { logger, httpLogger } from './logger';
import {
  requireMcpApiKey,
  createOAuthRouter,
  bootstrapStaticToken,
  getDefaultToken,
  getTokenStoreStats,
} from './auth';
import { createHealthRouter } from './health';
import {
  listChannelsSchema,
  getChannelHistorySchema,
  listChannels,
  getChannelHistory,
} from './tools/channels';
import {
  sendMessageSchema,
  getThreadRepliesSchema,
  sendMessage,
  getThreadReplies,
} from './tools/messages';
import { getUserInfoSchema, listUsersSchema, getUserInfo, listUsers } from './tools/users';
import { searchMessagesSchema, searchMessages } from './tools/search';

// ─── Express App ────────────────────────────────────────────────────────────

export const app = express();

app.use(express.json());
app.use(cookieParser());
app.use(httpLogger);

// ─── OAuth Routes ───────────────────────────────────────────────────────────

app.use('/auth', createOAuthRouter());

app.get('/auth/status', (_req, res) => {
  const stats = getTokenStoreStats();
  res.json({
    installedWorkspaces: stats.installedWorkspaces,
    teamIds: stats.teamIds,
  });
});

// ─── Health ─────────────────────────────────────────────────────────────────

app.use('/health', createHealthRouter());

// ─── Slack client resolution ───────────────────────────────────────────────

function getClient(): WebClient {
  const token = getDefaultToken();
  if (!token) {
    throw new Error(
      'No Slack workspace installed. Visit /auth/slack to connect a workspace, or set SLACK_BOT_TOKEN.'
    );
  }
  return new WebClient(token.botToken);
}

// ─── MCP Server ─────────────────────────────────────────────────────────────

const mcpServer = new McpServer({
  name: 'slack-mcp-server',
  version: '1.0.0',
});

// Tool: slack_list_channels
mcpServer.tool(
  'slack_list_channels',
  'List public and private channels in the connected Slack workspace, with pagination support.',
  listChannelsSchema.shape,
  async (params) => {
    try {
      const result = await listChannels(getClient(), params);
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
      };
    } catch (err) {
      return {
        content: [
          { type: 'text' as const, text: `Error: ${err instanceof Error ? err.message : String(err)}` },
        ],
        isError: true,
      };
    }
  }
);

// Tool: slack_get_channel_history
mcpServer.tool(
  'slack_get_channel_history',
  'Fetch recent messages from a Slack channel, optionally bounded by a time range.',
  getChannelHistorySchema.shape,
  async (params) => {
    try {
      const result = await getChannelHistory(getClient(), params);
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
      };
    } catch (err) {
      return {
        content: [
          { type: 'text' as const, text: `Error: ${err instanceof Error ? err.message : String(err)}` },
        ],
        isError: true,
      };
    }
  }
);

// Tool: slack_send_message
mcpServer.tool(
  'slack_send_message',
  'Post a message to a Slack channel, optionally as a threaded reply.',
  sendMessageSchema.shape,
  async (params) => {
    try {
      const result = await sendMessage(getClient(), params);
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
      };
    } catch (err) {
      return {
        content: [
          { type: 'text' as const, text: `Error: ${err instanceof Error ? err.message : String(err)}` },
        ],
        isError: true,
      };
    }
  }
);

// Tool: slack_get_thread_replies
mcpServer.tool(
  'slack_get_thread_replies',
  'Fetch all replies in a Slack message thread.',
  getThreadRepliesSchema.shape,
  async (params) => {
    try {
      const result = await getThreadReplies(getClient(), params);
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
      };
    } catch (err) {
      return {
        content: [
          { type: 'text' as const, text: `Error: ${err instanceof Error ? err.message : String(err)}` },
        ],
        isError: true,
      };
    }
  }
);

// Tool: slack_get_user_info
mcpServer.tool(
  'slack_get_user_info',
  'Get profile details for a specific Slack user by ID.',
  getUserInfoSchema.shape,
  async (params) => {
    try {
      const result = await getUserInfo(getClient(), params);
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
      };
    } catch (err) {
      return {
        content: [
          { type: 'text' as const, text: `Error: ${err instanceof Error ? err.message : String(err)}` },
        ],
        isError: true,
      };
    }
  }
);

// Tool: slack_list_users
mcpServer.tool(
  'slack_list_users',
  'List members of the connected Slack workspace, excluding bots and deleted users by default.',
  listUsersSchema.shape,
  async (params) => {
    try {
      const result = await listUsers(getClient(), params);
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
      };
    } catch (err) {
      return {
        content: [
          { type: 'text' as const, text: `Error: ${err instanceof Error ? err.message : String(err)}` },
        ],
        isError: true,
      };
    }
  }
);

// Tool: slack_search_messages
mcpServer.tool(
  'slack_search_messages',
  'Search messages across the Slack workspace using Slack search syntax.',
  searchMessagesSchema.shape,
  async (params) => {
    try {
      const result = await searchMessages(getClient(), params);
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
      };
    } catch (err) {
      return {
        content: [
          { type: 'text' as const, text: `Error: ${err instanceof Error ? err.message : String(err)}` },
        ],
        isError: true,
      };
    }
  }
);

// ─── MCP HTTP Route ─────────────────────────────────────────────────────────

const mcpLimiter = rateLimit({
  windowMs: config.RATE_LIMIT_WINDOW_MS,
  max: config.RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too Many Requests', message: 'Rate limit exceeded' },
});

app.post('/mcp', mcpLimiter, requireMcpApiKey, async (req, res) => {
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: uuidv4 });
  await mcpServer.connect(transport);
  await transport.handleRequest(req, res, req.body);
});

// ─── 404 ────────────────────────────────────────────────────────────────────

app.use((_req, res) => {
  res.status(404).json({ error: 'Not Found' });
});

// ─── Start ──────────────────────────────────────────────────────────────────

if (require.main === module) {
  bootstrapStaticToken()
    .catch((err) => logger.error({ err }, 'Static token bootstrap failed'))
    .finally(() => {
      app.listen(config.PORT, () => {
        logger.info(
          {
            port: config.PORT,
            env: config.NODE_ENV,
            oauthStart: `${config.BASE_URL}/auth/slack`,
          },
          'Slack MCP server started'
        );
      });
    });
}
