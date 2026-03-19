#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

import * as alerts from "./alerts.js";
import * as watchlists from "./watchlists.js";
import { resetSession } from "./client.js";

const server = new Server(
  { name: "tradingview-mcp", version: "0.1.0" },
  { capabilities: { tools: {} } }
);

// ─── Tool definitions ────────────────────────────────────────────────────────

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    // Alerts
    {
      name: "list_alerts",
      description: "List all active TradingView alerts",
      inputSchema: { type: "object", properties: {}, required: [] },
    },
    {
      name: "get_alert",
      description: "Get details of a specific alert by ID",
      inputSchema: {
        type: "object",
        properties: { id: { type: "string", description: "Alert ID" } },
        required: ["id"],
      },
    },
    {
      name: "create_alert",
      description: "Create a new price alert on TradingView",
      inputSchema: {
        type: "object",
        properties: {
          symbol: {
            type: "string",
            description: "Symbol in TradingView format, e.g. NASDAQ:AAPL",
          },
          condition: {
            type: "string",
            description: "Alert condition, e.g. 'crossing', 'greater_than', 'less_than'",
          },
          price: { type: "number", description: "Price level for the alert" },
          name: { type: "string", description: "Optional alert name" },
          message: {
            type: "string",
            description: "Optional message to send when alert fires",
          },
          expiration: {
            type: "string",
            description: "Optional ISO 8601 expiration datetime",
          },
        },
        required: ["symbol", "condition"],
      },
    },
    {
      name: "update_alert",
      description: "Update an existing alert",
      inputSchema: {
        type: "object",
        properties: {
          id: { type: "string", description: "Alert ID" },
          name: { type: "string" },
          price: { type: "number" },
          message: { type: "string" },
          expiration: { type: "string" },
          active: { type: "boolean" },
        },
        required: ["id"],
      },
    },
    {
      name: "delete_alert",
      description: "Delete an alert by ID",
      inputSchema: {
        type: "object",
        properties: { id: { type: "string", description: "Alert ID" } },
        required: ["id"],
      },
    },
    {
      name: "enable_alert",
      description: "Enable (activate) an alert",
      inputSchema: {
        type: "object",
        properties: { id: { type: "string" } },
        required: ["id"],
      },
    },
    {
      name: "disable_alert",
      description: "Disable (deactivate) an alert without deleting it",
      inputSchema: {
        type: "object",
        properties: { id: { type: "string" } },
        required: ["id"],
      },
    },
    // Watchlists
    {
      name: "list_watchlists",
      description: "List all TradingView watchlists",
      inputSchema: { type: "object", properties: {}, required: [] },
    },
    {
      name: "get_watchlist",
      description: "Get a watchlist and its symbols by ID",
      inputSchema: {
        type: "object",
        properties: { id: { type: "string" } },
        required: ["id"],
      },
    },
    {
      name: "create_watchlist",
      description: "Create a new watchlist",
      inputSchema: {
        type: "object",
        properties: {
          name: { type: "string", description: "Watchlist name" },
          symbols: {
            type: "array",
            items: { type: "string" },
            description: "Optional initial symbols, e.g. ['NASDAQ:AAPL', 'NYSE:TSLA']",
          },
        },
        required: ["name"],
      },
    },
    {
      name: "rename_watchlist",
      description: "Rename an existing watchlist",
      inputSchema: {
        type: "object",
        properties: {
          id: { type: "string" },
          name: { type: "string" },
        },
        required: ["id", "name"],
      },
    },
    {
      name: "add_symbols",
      description: "Add symbols to a watchlist",
      inputSchema: {
        type: "object",
        properties: {
          id: { type: "string", description: "Watchlist ID" },
          symbols: {
            type: "array",
            items: { type: "string" },
            description: "Symbols to add, e.g. ['NASDAQ:AAPL']",
          },
        },
        required: ["id", "symbols"],
      },
    },
    {
      name: "remove_symbols",
      description: "Remove symbols from a watchlist",
      inputSchema: {
        type: "object",
        properties: {
          id: { type: "string", description: "Watchlist ID" },
          symbols: {
            type: "array",
            items: { type: "string" },
            description: "Symbols to remove",
          },
        },
        required: ["id", "symbols"],
      },
    },
    {
      name: "delete_watchlist",
      description: "Delete a watchlist by ID",
      inputSchema: {
        type: "object",
        properties: { id: { type: "string" } },
        required: ["id"],
      },
    },
    // Session
    {
      name: "reset_session",
      description:
        "Clear the cached session and force re-authentication on next request",
      inputSchema: { type: "object", properties: {}, required: [] },
    },
  ],
}));

// ─── Tool handlers ───────────────────────────────────────────────────────────

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      // Alerts
      case "list_alerts": {
        const result = await alerts.listAlerts();
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      }
      case "get_alert": {
        const { id } = z.object({ id: z.string() }).parse(args);
        const result = await alerts.getAlert(id);
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      }
      case "create_alert": {
        const params = z
          .object({
            symbol: z.string(),
            condition: z.string(),
            price: z.number().optional(),
            name: z.string().optional(),
            message: z.string().optional(),
            expiration: z.string().optional(),
          })
          .parse(args);
        const result = await alerts.createAlert(params);
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      }
      case "update_alert": {
        const { id, ...params } = z
          .object({
            id: z.string(),
            name: z.string().optional(),
            price: z.number().optional(),
            message: z.string().optional(),
            expiration: z.string().optional(),
            active: z.boolean().optional(),
          })
          .parse(args);
        const result = await alerts.updateAlert(id, params);
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      }
      case "delete_alert": {
        const { id } = z.object({ id: z.string() }).parse(args);
        await alerts.deleteAlert(id);
        return { content: [{ type: "text", text: `Alert ${id} deleted.` }] };
      }
      case "enable_alert": {
        const { id } = z.object({ id: z.string() }).parse(args);
        const result = await alerts.setAlertActive(id, true);
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      }
      case "disable_alert": {
        const { id } = z.object({ id: z.string() }).parse(args);
        const result = await alerts.setAlertActive(id, false);
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      }
      // Watchlists
      case "list_watchlists": {
        const result = await watchlists.listWatchlists();
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      }
      case "get_watchlist": {
        const { id } = z.object({ id: z.string() }).parse(args);
        const result = await watchlists.getWatchlist(id);
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      }
      case "create_watchlist": {
        const { name: wlName, symbols } = z
          .object({ name: z.string(), symbols: z.array(z.string()).optional() })
          .parse(args);
        const result = await watchlists.createWatchlist(wlName, symbols);
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      }
      case "rename_watchlist": {
        const { id, name: wlName } = z
          .object({ id: z.string(), name: z.string() })
          .parse(args);
        const result = await watchlists.renameWatchlist(id, wlName);
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      }
      case "add_symbols": {
        const { id, symbols } = z
          .object({ id: z.string(), symbols: z.array(z.string()) })
          .parse(args);
        const result = await watchlists.addSymbols(id, symbols);
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      }
      case "remove_symbols": {
        const { id, symbols } = z
          .object({ id: z.string(), symbols: z.array(z.string()) })
          .parse(args);
        const result = await watchlists.removeSymbols(id, symbols);
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      }
      case "delete_watchlist": {
        const { id } = z.object({ id: z.string() }).parse(args);
        await watchlists.deleteWatchlist(id);
        return { content: [{ type: "text", text: `Watchlist ${id} deleted.` }] };
      }
      // Session
      case "reset_session": {
        resetSession();
        return { content: [{ type: "text", text: "Session cleared. Will re-authenticate on next request." }] };
      }
      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      content: [{ type: "text", text: `Error: ${message}` }],
      isError: true,
    };
  }
});

// ─── Start ───────────────────────────────────────────────────────────────────

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("TradingView MCP server running on stdio");
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
