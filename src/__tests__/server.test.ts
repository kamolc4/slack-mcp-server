import request from 'supertest';
import { app } from '../server';
import { requireMcpApiKey } from '../auth';
import type { Request, Response, NextFunction } from 'express';

describe('HTTP server', () => {
  it('returns health status with dependency information', async () => {
    const response = await request(app).get('/health');

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('status');
    expect(response.body).toHaveProperty('dependencies.slackApi.status');
    expect(response.body).toHaveProperty('dependencies.tokenStore.status');
  });

  it('rejects /mcp requests without an API key', async () => {
    const response = await request(app)
      .post('/mcp')
      .send({ jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} });

    expect(response.status).toBe(401);
    expect(response.body.detail).toContain('Authorization');
  });

  it('rejects /mcp requests with an invalid API key', async () => {
    const response = await request(app)
      .post('/mcp')
      .set('Authorization', 'Bearer wrong-key')
      .send({ jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} });

    expect(response.status).toBe(401);
    expect(response.body.detail).toBe('Invalid API key');
  });

  it('allows requests with a valid API key to reach the MCP handler', async () => {
    const response = await request(app)
      .post('/mcp')
      .set('Authorization', `Bearer ${process.env['MCP_API_KEY']}`)
      .send({ jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} });

    expect(response.status).toBeLessThan(500);
    expect(response.status).not.toBe(401);
  });
});

describe('requireMcpApiKey middleware', () => {
  function mockResponse(): Response {
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    return res as unknown as Response;
  }

  it('calls next for a valid bearer token', () => {
    const req = {
      headers: { authorization: `Bearer ${process.env['MCP_API_KEY']}` },
    } as Request;
    const res = mockResponse();
    const next: NextFunction = jest.fn();

    requireMcpApiKey(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
  });

  it('rejects malformed authorization headers', () => {
    const req = { headers: { authorization: 'Token abc' } } as Request;
    const res = mockResponse();
    const next: NextFunction = jest.fn();

    requireMcpApiKey(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });
});
