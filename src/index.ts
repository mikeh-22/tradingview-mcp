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
import * as market from "./market.js";
import * as screener from "./screener.js";
import * as news from "./news.js";
import * as calendar from "./calendar.js";
import * as layouts from "./layouts.js";
import * as ohlcv from "./ohlcv.js";
import * as drawings from "./drawings.js";
import * as scripts from "./scripts.js";
import * as account from "./account.js";
import { resetSession } from "./client.js";
import { SCREENER_FIELDS } from "./screener.js";

const server = new Server(
  { name: "tradingview-mcp", version: "0.1.0" },
  { capabilities: { tools: {} } }
);

// ─── Tool definitions ────────────────────────────────────────────────────────

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    // ── Alerts ──────────────────────────────────────────────────────────────
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
          symbol: { type: "string", description: "Symbol in EXCHANGE:TICKER format, e.g. NASDAQ:AAPL" },
          condition: { type: "string", description: "Alert condition: crossing, greater_than, less_than" },
          price: { type: "number", description: "Price level for the alert" },
          name: { type: "string", description: "Optional alert name" },
          message: { type: "string", description: "Optional message to send when alert fires" },
          expiration: { type: "string", description: "Optional ISO 8601 expiration datetime" },
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
          id: { type: "string" },
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
        properties: { id: { type: "string" } },
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

    // ── Watchlists ───────────────────────────────────────────────────────────
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
          name: { type: "string" },
          symbols: { type: "array", items: { type: "string" }, description: "Optional initial symbols" },
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
          id: { type: "string" },
          symbols: { type: "array", items: { type: "string" } },
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
          id: { type: "string" },
          symbols: { type: "array", items: { type: "string" } },
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

    // ── Market Data ──────────────────────────────────────────────────────────
    {
      name: "get_quote",
      description: "Get real-time price quote(s) for one or more symbols",
      inputSchema: {
        type: "object",
        properties: {
          symbols: {
            type: "array",
            items: { type: "string" },
            description: "Symbols in EXCHANGE:TICKER format, e.g. ['NASDAQ:AAPL', 'BINANCE:BTCUSDT']",
          },
        },
        required: ["symbols"],
      },
    },
    {
      name: "get_symbol_info",
      description: "Get detailed fundamental and technical info for a symbol",
      inputSchema: {
        type: "object",
        properties: {
          symbol: { type: "string", description: "Symbol in EXCHANGE:TICKER format" },
        },
        required: ["symbol"],
      },
    },
    {
      name: "search_symbols",
      description: "Search TradingView's symbol database by name or ticker",
      inputSchema: {
        type: "object",
        properties: {
          query: { type: "string", description: "Search query, e.g. 'Apple' or 'AAPL'" },
          exchange: { type: "string", description: "Filter by exchange, e.g. 'NASDAQ'" },
          type: { type: "string", description: "Filter by type: stock, fund, dr, right, bond, warrant, structured, forex, futures, crypto, index, economic" },
          limit: { type: "number", description: "Max results (default 30)" },
        },
        required: ["query"],
      },
    },
    {
      name: "get_ohlcv",
      description: "Get historical OHLCV (candlestick) data for a symbol",
      inputSchema: {
        type: "object",
        properties: {
          symbol: { type: "string", description: "Symbol in EXCHANGE:TICKER format" },
          resolution: {
            type: "string",
            description: "Timeframe: 1m 3m 5m 15m 30m 45m 1h 2h 3h 4h 1D 1W 1M",
          },
          countback: { type: "number", description: "Number of bars to fetch (default 300)" },
          from: { type: "number", description: "Start time as Unix timestamp (seconds)" },
          to: { type: "number", description: "End time as Unix timestamp (seconds)" },
        },
        required: ["symbol", "resolution"],
      },
    },

    // ── Screener ─────────────────────────────────────────────────────────────
    {
      name: "screen_stocks",
      description: "Screen US stocks using filters (market cap, P/E, RSI, etc.)",
      inputSchema: {
        type: "object",
        properties: {
          filters: {
            type: "array",
            description: "Filter conditions",
            items: {
              type: "object",
              properties: {
                left: { type: "string", description: "Field name, e.g. 'market_cap_basic'" },
                operation: { type: "string", description: "Operator: greater, less, greater_or_equal, less_or_equal, equal, in_range, in" },
                right: { description: "Value or [min, max] for in_range" },
              },
              required: ["left", "operation", "right"],
            },
          },
          columns: { type: "array", items: { type: "string" }, description: "Fields to return (uses defaults if omitted)" },
          sort: {
            type: "object",
            properties: {
              sortBy: { type: "string" },
              sortOrder: { type: "string", enum: ["asc", "desc"] },
            },
          },
          range: {
            type: "array",
            items: { type: "number" },
            description: "[offset, limit], e.g. [0, 25]",
          },
        },
        required: [],
      },
    },
    {
      name: "screen_crypto",
      description: "Screen crypto assets using filters",
      inputSchema: {
        type: "object",
        properties: {
          filters: { type: "array", items: { type: "object" } },
          columns: { type: "array", items: { type: "string" } },
          sort: { type: "object" },
          range: { type: "array", items: { type: "number" } },
        },
        required: [],
      },
    },
    {
      name: "screen_forex",
      description: "Screen forex pairs using filters",
      inputSchema: {
        type: "object",
        properties: {
          filters: { type: "array", items: { type: "object" } },
          columns: { type: "array", items: { type: "string" } },
          sort: { type: "object" },
          range: { type: "array", items: { type: "number" } },
        },
        required: [],
      },
    },
    {
      name: "get_screener_fields",
      description: "List available screener field names by category (price, volume, fundamentals, technical, etc.)",
      inputSchema: { type: "object", properties: {}, required: [] },
    },

    // ── News & Ideas ─────────────────────────────────────────────────────────
    {
      name: "get_news",
      description: "Get latest news headlines for a symbol",
      inputSchema: {
        type: "object",
        properties: {
          symbol: { type: "string", description: "Symbol in EXCHANGE:TICKER format" },
          count: { type: "number", description: "Number of headlines to return (default 20)" },
        },
        required: ["symbol"],
      },
    },
    {
      name: "search_ideas",
      description: "Search published TradingView chart ideas by symbol or keyword",
      inputSchema: {
        type: "object",
        properties: {
          symbol: { type: "string", description: "Filter ideas by symbol" },
          query: { type: "string", description: "Keyword filter" },
          sort: { type: "string", enum: ["recent", "popular", "editors_pick"], description: "Sort order (default: recent)" },
          page: { type: "number", description: "Page number (default 1)" },
        },
        required: [],
      },
    },
    {
      name: "get_trending_ideas",
      description: "Get trending/popular TradingView chart ideas",
      inputSchema: {
        type: "object",
        properties: {
          page: { type: "number", description: "Page number (default 1)" },
        },
        required: [],
      },
    },

    // ── Economic Calendar ────────────────────────────────────────────────────
    {
      name: "get_economic_calendar",
      description: "Get upcoming economic events and data releases (GDP, CPI, FOMC, etc.)",
      inputSchema: {
        type: "object",
        properties: {
          from: { type: "string", description: "Start date, ISO 8601, e.g. '2024-01-01' (default: now)" },
          to: { type: "string", description: "End date, ISO 8601 (default: 7 days from now)" },
          countries: {
            type: "array",
            items: { type: "string" },
            description: "Country codes to filter by, e.g. ['US', 'EU', 'GB', 'JP']",
          },
          minImpact: { type: "string", enum: ["low", "medium", "high"], description: "Minimum impact level" },
        },
        required: [],
      },
    },

    // ── Chart Layouts ────────────────────────────────────────────────────────
    {
      name: "list_layouts",
      description: "List all saved TradingView chart layouts",
      inputSchema: { type: "object", properties: {}, required: [] },
    },
    {
      name: "get_layout",
      description: "Get the full configuration of a saved chart layout",
      inputSchema: {
        type: "object",
        properties: { id: { type: "string", description: "Layout ID" } },
        required: ["id"],
      },
    },
    {
      name: "delete_layout",
      description: "Delete a saved chart layout",
      inputSchema: {
        type: "object",
        properties: { id: { type: "string", description: "Layout ID" } },
        required: ["id"],
      },
    },

    // ── Drawings ─────────────────────────────────────────────────────────────
    {
      name: "list_drawings",
      description: "List all drawings (trend lines, levels, etc.) on a chart layout",
      inputSchema: {
        type: "object",
        properties: { layoutId: { type: "string", description: "Layout ID" } },
        required: ["layoutId"],
      },
    },
    {
      name: "save_drawing",
      description: "Add a drawing to a chart layout",
      inputSchema: {
        type: "object",
        properties: {
          layoutId: { type: "string", description: "Layout ID" },
          type: { type: "string", description: "Drawing type, e.g. 'LineToolTrendLine', 'LineToolHorzLine'" },
          points: { type: "array", description: "Array of coordinate points" },
          options: { type: "object", description: "Drawing style options" },
        },
        required: ["layoutId", "type"],
      },
    },
    {
      name: "delete_drawing",
      description: "Delete a drawing from a chart layout",
      inputSchema: {
        type: "object",
        properties: {
          layoutId: { type: "string" },
          drawingId: { type: "string" },
        },
        required: ["layoutId", "drawingId"],
      },
    },

    // ── Pine Scripts ─────────────────────────────────────────────────────────
    {
      name: "list_scripts",
      description: "List your saved Pine Script indicators and strategies",
      inputSchema: {
        type: "object",
        properties: {
          orderBy: { type: "string", enum: ["modified_time", "views_count", "description"], description: "Sort field (default: modified_time)" },
          limit: { type: "number", description: "Max results (default 100)" },
        },
        required: [],
      },
    },
    {
      name: "get_script",
      description: "Get the Pine Script source code for a saved script",
      inputSchema: {
        type: "object",
        properties: {
          id: { type: "string", description: "Script ID" },
          version: { type: "string", description: "Script version (uses latest if omitted)" },
        },
        required: ["id"],
      },
    },

    // ── Account ──────────────────────────────────────────────────────────────
    {
      name: "get_account",
      description: "Get your TradingView account details (username, plan, reputation, etc.)",
      inputSchema: { type: "object", properties: {}, required: [] },
    },
    {
      name: "get_notification_settings",
      description: "Get your TradingView alert notification settings",
      inputSchema: { type: "object", properties: {}, required: [] },
    },

    // ── Session ──────────────────────────────────────────────────────────────
    {
      name: "reset_session",
      description: "Clear the cached session and force re-authentication on next request",
      inputSchema: { type: "object", properties: {}, required: [] },
    },
  ],
}));

// ─── Tool handlers ───────────────────────────────────────────────────────────

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {

      // ── Alerts ─────────────────────────────────────────────────────────────
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
        const params = z.object({
          symbol: z.string(),
          condition: z.string(),
          price: z.number().optional(),
          name: z.string().optional(),
          message: z.string().optional(),
          expiration: z.string().optional(),
        }).parse(args);
        const result = await alerts.createAlert(params);
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      }
      case "update_alert": {
        const { id, ...params } = z.object({
          id: z.string(),
          name: z.string().optional(),
          price: z.number().optional(),
          message: z.string().optional(),
          expiration: z.string().optional(),
          active: z.boolean().optional(),
        }).parse(args);
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

      // ── Watchlists ──────────────────────────────────────────────────────────
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
        const { name: wlName, symbols } = z.object({
          name: z.string(),
          symbols: z.array(z.string()).optional(),
        }).parse(args);
        const result = await watchlists.createWatchlist(wlName, symbols);
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      }
      case "rename_watchlist": {
        const { id, name: wlName } = z.object({ id: z.string(), name: z.string() }).parse(args);
        const result = await watchlists.renameWatchlist(id, wlName);
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      }
      case "add_symbols": {
        const { id, symbols } = z.object({ id: z.string(), symbols: z.array(z.string()) }).parse(args);
        const result = await watchlists.addSymbols(id, symbols);
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      }
      case "remove_symbols": {
        const { id, symbols } = z.object({ id: z.string(), symbols: z.array(z.string()) }).parse(args);
        const result = await watchlists.removeSymbols(id, symbols);
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      }
      case "delete_watchlist": {
        const { id } = z.object({ id: z.string() }).parse(args);
        await watchlists.deleteWatchlist(id);
        return { content: [{ type: "text", text: `Watchlist ${id} deleted.` }] };
      }

      // ── Market Data ─────────────────────────────────────────────────────────
      case "get_quote": {
        const { symbols } = z.object({ symbols: z.array(z.string()) }).parse(args);
        const result = await market.getQuote(symbols);
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      }
      case "get_symbol_info": {
        const { symbol } = z.object({ symbol: z.string() }).parse(args);
        const result = await market.getSymbolInfo(symbol);
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      }
      case "search_symbols": {
        const { query, exchange, type, limit } = z.object({
          query: z.string(),
          exchange: z.string().optional(),
          type: z.string().optional(),
          limit: z.number().optional(),
        }).parse(args);
        const result = await market.searchSymbols(query, { exchange, type, limit });
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      }
      case "get_ohlcv": {
        const { symbol, resolution, countback, from, to } = z.object({
          symbol: z.string(),
          resolution: z.string(),
          countback: z.number().optional(),
          from: z.number().optional(),
          to: z.number().optional(),
        }).parse(args);
        const result = await ohlcv.getOHLCV(symbol, resolution, { countback, from, to });
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      }

      // ── Screener ────────────────────────────────────────────────────────────
      case "screen_stocks": {
        const opts = z.object({
          filters: z.array(z.object({
            left: z.string(),
            operation: z.string(),
            right: z.unknown(),
          })).optional(),
          columns: z.array(z.string()).optional(),
          sort: z.object({ sortBy: z.string(), sortOrder: z.enum(["asc", "desc"]) }).optional(),
          range: z.tuple([z.number(), z.number()]).optional(),
        }).parse(args);
        const result = await screener.screenStocks(opts as screener.ScreenerOptions);
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      }
      case "screen_crypto": {
        const opts = z.object({
          filters: z.array(z.object({ left: z.string(), operation: z.string(), right: z.unknown() })).optional(),
          columns: z.array(z.string()).optional(),
          sort: z.object({ sortBy: z.string(), sortOrder: z.enum(["asc", "desc"]) }).optional(),
          range: z.tuple([z.number(), z.number()]).optional(),
        }).parse(args);
        const result = await screener.screenCrypto(opts as screener.ScreenerOptions);
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      }
      case "screen_forex": {
        const opts = z.object({
          filters: z.array(z.object({ left: z.string(), operation: z.string(), right: z.unknown() })).optional(),
          columns: z.array(z.string()).optional(),
          sort: z.object({ sortBy: z.string(), sortOrder: z.enum(["asc", "desc"]) }).optional(),
          range: z.tuple([z.number(), z.number()]).optional(),
        }).parse(args);
        const result = await screener.screenForex(opts as screener.ScreenerOptions);
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      }
      case "get_screener_fields": {
        return { content: [{ type: "text", text: JSON.stringify(SCREENER_FIELDS, null, 2) }] };
      }

      // ── News & Ideas ────────────────────────────────────────────────────────
      case "get_news": {
        const { symbol, count } = z.object({ symbol: z.string(), count: z.number().optional() }).parse(args);
        const result = await news.getNews(symbol, count);
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      }
      case "search_ideas": {
        const opts = z.object({
          symbol: z.string().optional(),
          query: z.string().optional(),
          sort: z.enum(["recent", "popular", "editors_pick"]).optional(),
          page: z.number().optional(),
        }).parse(args);
        const result = await news.searchIdeas(opts);
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      }
      case "get_trending_ideas": {
        const { page } = z.object({ page: z.number().optional() }).parse(args ?? {});
        const result = await news.getTrendingIdeas(page);
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      }

      // ── Economic Calendar ───────────────────────────────────────────────────
      case "get_economic_calendar": {
        const opts = z.object({
          from: z.string().optional(),
          to: z.string().optional(),
          countries: z.array(z.string()).optional(),
          minImpact: z.enum(["low", "medium", "high"]).optional(),
        }).parse(args ?? {});
        const result = await calendar.getEconomicCalendar(opts);
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      }

      // ── Chart Layouts ───────────────────────────────────────────────────────
      case "list_layouts": {
        const result = await layouts.listLayouts();
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      }
      case "get_layout": {
        const { id } = z.object({ id: z.string() }).parse(args);
        const result = await layouts.getLayout(id);
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      }
      case "delete_layout": {
        const { id } = z.object({ id: z.string() }).parse(args);
        await layouts.deleteLayout(id);
        return { content: [{ type: "text", text: `Layout ${id} deleted.` }] };
      }

      // ── Drawings ────────────────────────────────────────────────────────────
      case "list_drawings": {
        const { layoutId } = z.object({ layoutId: z.string() }).parse(args);
        const result = await drawings.listDrawings(layoutId);
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      }
      case "save_drawing": {
        const { layoutId, type: drawingType, points, options: drawingOptions } = z.object({
          layoutId: z.string(),
          type: z.string(),
          points: z.array(z.unknown()).optional(),
          options: z.record(z.unknown()).optional(),
        }).parse(args);
        const result = await drawings.saveDrawing(layoutId, { type: drawingType, points, options: drawingOptions });
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      }
      case "delete_drawing": {
        const { layoutId, drawingId } = z.object({ layoutId: z.string(), drawingId: z.string() }).parse(args);
        await drawings.deleteDrawing(layoutId, drawingId);
        return { content: [{ type: "text", text: `Drawing ${drawingId} deleted from layout ${layoutId}.` }] };
      }

      // ── Pine Scripts ────────────────────────────────────────────────────────
      case "list_scripts": {
        const { orderBy, limit } = z.object({
          orderBy: z.enum(["modified_time", "views_count", "description"]).optional(),
          limit: z.number().optional(),
        }).parse(args ?? {});
        const result = await scripts.listScripts({ orderBy, limit });
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      }
      case "get_script": {
        const { id, version } = z.object({ id: z.string(), version: z.string().optional() }).parse(args);
        const result = await scripts.getScript(id, version);
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      }

      // ── Account ─────────────────────────────────────────────────────────────
      case "get_account": {
        const result = await account.getAccount();
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      }
      case "get_notification_settings": {
        const result = await account.getNotificationSettings();
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      }

      // ── Session ─────────────────────────────────────────────────────────────
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
