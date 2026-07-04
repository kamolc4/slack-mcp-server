import { Request, Response, NextFunction, Router } from 'express';
import { WebClient } from '@slack/web-api';
import { v4 as uuidv4 } from 'uuid';
import { config } from './config';
import { logger } from './logger';

// In-memory token store — replace with Redis/DB in multi-instance deployments
const tokenStore = new Map<string, SlackTokenRecord>();

export interface SlackTokenRecord {
  teamId: string;
  teamName: string;
  botToken: string;
  botUserId: string;
  installedAt: Date;
  scope: string;
}

// Pending OAuth states (CSRF protection)
const pendingStates = new Map<string, { createdAt: Date }>();

// Clean up expired states every 10 minutes
const pendingStateCleanupInterval = setInterval(() => {
  const cutoff = new Date(Date.now() - 10 * 60 * 1000);
  for (const [state, data] of pendingStates.entries()) {
    if (data.createdAt < cutoff) {
      pendingStates.delete(state);
    }
  }
}, 10 * 60 * 1000);
pendingStateCleanupInterval.unref?.();

/**
 * Bootstrap with a pre-existing bot token (from SLACK_BOT_TOKEN env var).
 * This allows the server to work without going through the OAuth flow.
 */
export async function bootstrapStaticToken(): Promise<void> {
  if (!config.SLACK_BOT_TOKEN) return;

  try {
    const client = new WebClient(config.SLACK_BOT_TOKEN);
    const authResult = await client.auth.test();

    if (!authResult.ok || !authResult.team_id) {
      logger.warn('Static SLACK_BOT_TOKEN failed auth.test — skipping bootstrap');
      return;
    }

    const record: SlackTokenRecord = {
      teamId: authResult.team_id,
      teamName: (authResult.team as string) ?? 'Unknown',
      botToken: config.SLACK_BOT_TOKEN,
      botUserId: (authResult.user_id as string) ?? 'unknown',
      installedAt: new Date(),
      scope: 'static',
    };

    tokenStore.set(authResult.team_id, record);
    logger.info(
      { teamId: authResult.team_id, teamName: record.teamName },
      'Bootstrapped static Slack bot token'
    );
  } catch (err) {
    logger.error({ err }, 'Failed to bootstrap static Slack bot token');
  }
}

/**
 * Get the first available Slack token (single-workspace mode).
 * For multi-workspace, look up by teamId.
 */
export function getDefaultToken(): SlackTokenRecord | undefined {
  const [first] = tokenStore.values();
  return first;
}

export function getTokenByTeam(teamId: string): SlackTokenRecord | undefined {
  return tokenStore.get(teamId);
}

export function getTokenStoreStats(): { installedWorkspaces: number; teamIds: string[] } {
  return {
    installedWorkspaces: tokenStore.size,
    teamIds: Array.from(tokenStore.keys()),
  };
}

/**
 * Express middleware: validates Bearer token on /mcp requests.
 * Expects: Authorization: Bearer <MCP_API_KEY>
 */
export function requireMcpApiKey(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const authHeader = req.headers.authorization ?? '';
  const [scheme, token] = authHeader.split(' ');

  if (scheme !== 'Bearer' || !token) {
    res.status(401).json({
      type: 'https://httpstatuses.com/401',
      title: 'Unauthorized',
      detail: 'Missing or malformed Authorization header. Expected: Bearer <token>',
      status: 401,
    });
    return;
  }

  if (token !== config.MCP_API_KEY) {
    res.status(401).json({
      type: 'https://httpstatuses.com/401',
      title: 'Unauthorized',
      detail: 'Invalid API key',
      status: 401,
    });
    return;
  }

  next();
}

/**
 * OAuth router: handles /auth/slack and /auth/slack/callback
 */
export function createOAuthRouter(): Router {
  const router = Router();

  // Step 1: Redirect to Slack authorization page
  router.get('/slack', (_req: Request, res: Response) => {
    const state = uuidv4();
    pendingStates.set(state, { createdAt: new Date() });

    const scopes = [
      'channels:read',
      'channels:history',
      'users:read',
      'search:read',
      'chat:write',
    ].join(',');

    const params = new URLSearchParams({
      client_id: config.SLACK_CLIENT_ID,
      scope: scopes,
      redirect_uri: config.SLACK_REDIRECT_URI,
      state,
    });

    const authUrl = `https://slack.com/oauth/v2/authorize?${params.toString()}`;
    logger.info({ state }, 'Initiating Slack OAuth flow');
    res.redirect(authUrl);
  });

  // Step 2: Handle callback from Slack
  router.get('/slack/callback', async (req: Request, res: Response) => {
    const { code, state, error } = req.query as Record<string, string>;

    if (error) {
      logger.warn({ error }, 'Slack OAuth denied by user');
      res.status(400).send(`OAuth denied: ${error}`);
      return;
    }

    if (!state || !pendingStates.has(state)) {
      logger.warn({ state }, 'Invalid or expired OAuth state parameter');
      res.status(400).send('Invalid state parameter — possible CSRF attempt');
      return;
    }

    pendingStates.delete(state);

    if (!code) {
      res.status(400).send('Missing authorization code');
      return;
    }

    try {
      const client = new WebClient();
      const oauthResult = await client.oauth.v2.access({
        client_id: config.SLACK_CLIENT_ID,
        client_secret: config.SLACK_CLIENT_SECRET,
        code,
        redirect_uri: config.SLACK_REDIRECT_URI,
      });

      if (!oauthResult.ok || !oauthResult.access_token) {
        logger.error({ oauthResult }, 'Slack OAuth token exchange failed');
        res.status(500).send('Token exchange failed');
        return;
      }

      const teamId = (oauthResult.team as { id: string } | undefined)?.id ?? 'unknown';
      const teamName = (oauthResult.team as { name: string } | undefined)?.name ?? 'Unknown';
      const botUserId =
        (oauthResult.bot_user_id as string | undefined) ?? 'unknown';
      const scope = (oauthResult.scope as string | undefined) ?? '';

      const record: SlackTokenRecord = {
        teamId,
        teamName,
        botToken: oauthResult.access_token,
        botUserId,
        installedAt: new Date(),
        scope,
      };

      tokenStore.set(teamId, record);

      logger.info(
        { teamId, teamName, botUserId },
        'Slack workspace installed successfully'
      );

      res
        .status(200)
        .send(
          `<html><body><h1>✅ Slack MCP Server Installed</h1><p>Workspace <strong>${teamName}</strong> connected successfully. You can close this window.</p></body></html>`
        );
    } catch (err) {
      logger.error({ err }, 'Slack OAuth callback error');
      res.status(500).send('Internal server error during OAuth');
    }
  });

  return router;
}
