import { Request, Response, Router } from 'express';
import { WebClient } from '@slack/web-api';
import { getDefaultToken, getTokenStoreStats } from './auth';
import { logger } from './logger';

type HealthStatus = 'ok' | 'degraded' | 'down';

interface DependencyCheck {
  status: HealthStatus;
  latencyMs?: number;
  detail?: string;
}

interface HealthResponse {
  status: HealthStatus;
  timestamp: string;
  uptime: number;
  version: string;
  dependencies: {
    slackApi: DependencyCheck;
    tokenStore: DependencyCheck;
  };
}

async function checkSlackApi(): Promise<DependencyCheck> {
  const token = getDefaultToken();
  if (!token) {
    return {
      status: 'degraded',
      detail: 'No Slack token installed — visit /auth/slack to connect a workspace',
    };
  }

  const start = Date.now();
  try {
    const client = new WebClient(token.botToken);
    const result = await client.auth.test();
    const latencyMs = Date.now() - start;

    if (!result.ok) {
      return { status: 'down', latencyMs, detail: 'auth.test returned ok=false' };
    }

    return { status: 'ok', latencyMs };
  } catch (err) {
    const latencyMs = Date.now() - start;
    const detail = err instanceof Error ? err.message : String(err);
    return { status: 'down', latencyMs, detail };
  }
}

function checkTokenStore(): DependencyCheck {
  const stats = getTokenStoreStats();
  if (stats.installedWorkspaces === 0) {
    return {
      status: 'degraded',
      detail: 'No workspaces installed',
    };
  }
  return {
    status: 'ok',
    detail: `${stats.installedWorkspaces} workspace(s) installed: ${stats.teamIds.join(', ')}`,
  };
}

export function createHealthRouter(): Router {
  const router = Router();

  router.get('/', async (_req: Request, res: Response) => {
    const [slackApi] = await Promise.all([checkSlackApi()]);
    const tokenStore = checkTokenStore();

    const allStatuses: HealthStatus[] = [slackApi.status, tokenStore.status];
    const overallStatus: HealthStatus = allStatuses.includes('down')
      ? 'down'
      : allStatuses.includes('degraded')
      ? 'degraded'
      : 'ok';

    const body: HealthResponse = {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: process.env.npm_package_version ?? '1.0.0',
      dependencies: {
        slackApi,
        tokenStore,
      },
    };

    const httpStatus = overallStatus === 'down' ? 503 : 200;

    if (overallStatus !== 'ok') {
      logger.warn({ health: body }, 'Health check returned non-ok status');
    }

    res.status(httpStatus).json(body);
  });

  return router;
}
