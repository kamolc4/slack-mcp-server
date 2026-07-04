# Changelog

All notable changes to this project will be documented in this file.

## [1.0.0] - 2026-07-04

### Added
- Production-ready Slack MCP Server starter template.
- Slack OAuth 2.0 installation flow.
- Optional static `SLACK_BOT_TOKEN` bootstrap for single-workspace usage.
- MCP tools for channels, messages, threads, users, and search.
- `/health` endpoint with Slack API and token-store dependency checks.
- Bearer-token protection for `/mcp`.
- Configurable rate limiting for MCP requests.
- Structured Pino logging.
- Zod-based runtime configuration validation.
- Jest and Supertest test suite.
- GitHub Actions CI for install, lint, typecheck, test, and build.
- MIT license.
- MCPForge verification and badge documentation.
