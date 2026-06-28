---
name: mcp-builder
description: Scaffold and wire up a new Model Context Protocol (MCP) server for Forex data sources
---

Guide the user through building a new MCP server that exposes Forex trading data or external APIs as Claude-accessible tools.

Steps:
1. Ask (or infer from $ARGUMENTS) what data source or capability the MCP server should expose — e.g. "OANDA live prices", "CFTC COT data", "economic calendar", "broker account API".
2. Scaffold the server:
   - Create `mcp-servers/<name>/index.ts` using the `@modelcontextprotocol/sdk` TypeScript SDK.
   - Define `ListToolsRequestSchema` handlers for each capability.
   - Define `CallToolRequestSchema` handlers with proper input validation and error handling.
   - Add a `package.json` with build/start scripts and the MCP SDK dependency.
3. Register the server in `.claude/settings.json` under `mcpServers` with the correct `command` and `args`.
4. Print a summary of the tools exposed and example prompts a user can now ask Claude.

Keep the implementation minimal — only the tools explicitly requested. Do not add health checks, metrics, or middleware unless asked.
