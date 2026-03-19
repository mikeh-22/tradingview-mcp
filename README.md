# tradingview-mcp

A [Model Context Protocol (MCP)](https://modelcontextprotocol.io) server that lets AI assistants interact with TradingView — quotes, screener, alerts, watchlists, news, economic calendar, chart layouts, drawings, Pine scripts, and more. Connect it to Claude Desktop, Cursor, or any MCP-compatible client and interact with TradingView using natural language.

> **Disclaimer:** This project uses TradingView's internal, undocumented web API. It is not affiliated with or endorsed by TradingView. API endpoints may change without notice. Use in accordance with TradingView's Terms of Service.

---

## How It Works

TradingView's desktop and web apps communicate with their backend over a private REST API. This server:

1. **Authenticates** using a headless Chromium browser (via [Playwright](https://playwright.dev)) to replicate the normal login flow and obtain valid session cookies.
2. **Persists** those cookies to disk so re-authentication only happens when the session expires (~25 days).
3. **Exposes MCP tools** that make authenticated HTTP requests to TradingView's internal endpoints, plus a WebSocket connection for historical OHLCV data.

```
MCP Client (Claude, Cursor…)
        │  MCP protocol (stdio)
        ▼
  tradingview-mcp
        │  HTTPS + session cookies     WebSocket (OHLCV)
        ▼                                      ▼
  tradingview.com REST API         data.tradingview.com
```

---

## Features

- **Market Data** — real-time quotes, symbol search, detailed symbol info
- **Historical Data** — OHLCV candles via TradingView's WebSocket protocol
- **Screener** — filter stocks, crypto, and forex by price, fundamentals, and technicals
- **Alerts** — list, create, update, enable/disable, and delete price alerts
- **Watchlists** — list, create, rename, add/remove symbols, and delete watchlists
- **News & Ideas** — latest headlines per symbol, community ideas search, trending ideas
- **Economic Calendar** — upcoming macro events with impact ratings
- **Chart Layouts** — list, inspect, and delete saved chart layouts
- **Drawings** — list, add, and delete drawings on chart layouts
- **Pine Scripts** — list and retrieve source code for saved scripts
- **Account** — account details and notification settings
- **Session persistence** — logs in once via headless browser, reuses cookies for subsequent runs

---

## Requirements

- Node.js 18 or later
- A TradingView account (free tier is sufficient for most tools)

---

## Installation

```bash
# Clone the repository
git clone https://github.com/mikeh-22/tradingview-mcp.git
cd tradingview-mcp

# Install dependencies
npm install

# Install the Playwright Chromium browser used for login
npx playwright install chromium

# Set up credentials
cp .env.example .env
```

Edit `.env` with your TradingView credentials:

```env
TV_USERNAME=your_username_or_email
TV_PASSWORD=your_password

# Optional: custom path for the saved session file (default: .tv_session.json)
TV_SESSION_FILE=.tv_session.json
```

---

## Build & Run

```bash
npm run build   # compile TypeScript → dist/
npm start       # start the MCP server on stdio
```

On the **first run**, a headless Chromium window opens, navigates to tradingview.com, and logs in using your credentials. Session cookies are saved to `.tv_session.json`. All subsequent runs skip the browser entirely and use the saved session.

To force a fresh login, delete `.tv_session.json` or call the `reset_session` tool.

---

## Connecting to Claude Desktop

Add the server to your Claude Desktop config at:

- **macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows:** `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "tradingview": {
      "command": "node",
      "args": ["/absolute/path/to/tradingview-mcp/dist/index.js"],
      "env": {
        "TV_USERNAME": "your_username_or_email",
        "TV_PASSWORD": "your_password"
      }
    }
  }
}
```

Restart Claude Desktop after saving. You should see "tradingview" appear in the MCP tools list.

---

## Available Tools

### Market Data

#### `get_quote`
Returns real-time price data for one or more symbols.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `symbols` | string[] | ✓ | Symbols in `EXCHANGE:TICKER` format, e.g. `["NASDAQ:AAPL", "BINANCE:BTCUSDT"]` |

#### `get_symbol_info`
Returns detailed fundamental and technical data for a single symbol (P/E, EPS, 52-week high/low, beta, sector, etc.).

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `symbol` | string | ✓ | Symbol in `EXCHANGE:TICKER` format |

#### `search_symbols`
Searches TradingView's symbol database by name or ticker.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `query` | string | ✓ | Search term, e.g. `"Apple"` or `"AAPL"` |
| `exchange` | string | | Filter by exchange, e.g. `"NASDAQ"` |
| `type` | string | | Filter by type: `stock`, `crypto`, `forex`, `futures`, `index`, `fund`, etc. |
| `limit` | number | | Max results (default 30) |

#### `get_ohlcv`
Returns historical OHLCV candlestick data via TradingView's WebSocket protocol.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `symbol` | string | ✓ | Symbol in `EXCHANGE:TICKER` format |
| `resolution` | string | ✓ | Timeframe: `1m` `3m` `5m` `15m` `30m` `45m` `1h` `2h` `3h` `4h` `1D` `1W` `1M` |
| `countback` | number | | Number of bars to fetch (default 300) |
| `from` | number | | Start time as Unix timestamp (seconds) |
| `to` | number | | End time as Unix timestamp (seconds) |

---

### Screener

#### `screen_stocks`
Screens US equities using price, volume, fundamental, and technical filters.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `filters` | Filter[] | | Array of filter conditions (see below) |
| `columns` | string[] | | Fields to return (uses sensible defaults if omitted) |
| `sort` | object | | `{ sortBy: string, sortOrder: "asc" \| "desc" }` |
| `range` | [number, number] | | Pagination: `[offset, limit]`, e.g. `[0, 25]` |

#### `screen_crypto`
Screens crypto assets. Same parameters as `screen_stocks`.

#### `screen_forex`
Screens forex pairs. Same parameters as `screen_stocks`.

#### `get_screener_fields`
Returns a reference list of all available screener field names, grouped by category (price, volume, fundamentals, technicals, volatility, metadata).

```
(no parameters)
```

**Filter object format:**

```json
{ "left": "market_cap_basic", "operation": "greater", "right": 1000000000 }
```

Supported operations: `greater`, `less`, `greater_or_equal`, `less_or_equal`, `equal`, `not_equal`, `in_range`, `not_in_range`, `in`, `not_in`, `crosses_up`, `crosses_down`

For `in_range`: `right` should be `[min, max]`. Example — RSI between 30 and 50:

```json
{ "left": "RSI", "operation": "in_range", "right": [30, 50] }
```

---

### Alerts

#### `list_alerts`
Returns all alerts on your account.

```
(no parameters)
```

#### `get_alert`
Returns full details for a single alert.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | string | ✓ | Alert ID |

#### `create_alert`
Creates a new alert.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `symbol` | string | ✓ | Symbol in `EXCHANGE:TICKER` format |
| `condition` | string | ✓ | Condition type: `crossing`, `greater_than`, `less_than` |
| `price` | number | | Price level to trigger at |
| `name` | string | | Display name for the alert |
| `message` | string | | Message sent when the alert fires |
| `expiration` | string | | ISO 8601 datetime when the alert expires |

#### `update_alert`
Modifies an existing alert.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | string | ✓ | Alert ID |
| `name` | string | | New name |
| `price` | number | | New price level |
| `message` | string | | New message |
| `expiration` | string | | New expiration datetime |
| `active` | boolean | | Enable or disable the alert |

#### `delete_alert`
Permanently deletes an alert.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | string | ✓ | Alert ID |

#### `enable_alert` / `disable_alert`
Toggles an alert on or off without deleting it.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | string | ✓ | Alert ID |

---

### Watchlists

#### `list_watchlists`
Returns all watchlists with their symbols.

```
(no parameters)
```

#### `get_watchlist`
Returns a single watchlist and its full symbol list.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | string | ✓ | Watchlist ID |

#### `create_watchlist`
Creates a new watchlist, optionally pre-populated with symbols.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `name` | string | ✓ | Watchlist name |
| `symbols` | string[] | | Initial symbols, e.g. `["NASDAQ:AAPL", "NYSE:TSLA"]` |

#### `rename_watchlist`
Renames an existing watchlist.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | string | ✓ | Watchlist ID |
| `name` | string | ✓ | New name |

#### `add_symbols`
Adds one or more symbols to a watchlist.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | string | ✓ | Watchlist ID |
| `symbols` | string[] | ✓ | Symbols to add |

#### `remove_symbols`
Removes one or more symbols from a watchlist.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | string | ✓ | Watchlist ID |
| `symbols` | string[] | ✓ | Symbols to remove |

#### `delete_watchlist`
Permanently deletes a watchlist.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | string | ✓ | Watchlist ID |

---

### News & Ideas

#### `get_news`
Returns the latest news headlines for a symbol.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `symbol` | string | ✓ | Symbol in `EXCHANGE:TICKER` format |
| `count` | number | | Number of headlines to return (default 20) |

#### `search_ideas`
Searches published TradingView chart ideas.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `symbol` | string | | Filter ideas by symbol |
| `query` | string | | Keyword filter |
| `sort` | string | | `recent` (default), `popular`, or `editors_pick` |
| `page` | number | | Page number (default 1) |

#### `get_trending_ideas`
Returns trending/popular TradingView chart ideas.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `page` | number | | Page number (default 1) |

---

### Economic Calendar

#### `get_economic_calendar`
Returns upcoming economic events — GDP, CPI, FOMC decisions, jobs reports, etc.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `from` | string | | Start date, ISO 8601 (default: now) |
| `to` | string | | End date, ISO 8601 (default: 7 days from now) |
| `countries` | string[] | | Country codes to filter by, e.g. `["US", "EU", "GB", "JP"]` |
| `minImpact` | string | | Minimum impact level: `low`, `medium`, or `high` |

---

### Chart Layouts

#### `list_layouts`
Returns all saved chart layouts.

```
(no parameters)
```

#### `get_layout`
Returns the full configuration of a saved layout (symbol, timeframe, indicators, settings).

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | string | ✓ | Layout ID |

#### `delete_layout`
Permanently deletes a saved layout.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | string | ✓ | Layout ID |

---

### Drawings

#### `list_drawings`
Returns all drawings on a chart layout (trend lines, horizontal levels, etc.).

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `layoutId` | string | ✓ | Layout ID |

#### `save_drawing`
Adds a drawing to a chart layout.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `layoutId` | string | ✓ | Layout ID |
| `type` | string | ✓ | Drawing type, e.g. `LineToolTrendLine`, `LineToolHorzLine` |
| `points` | array | | Coordinate points for the drawing |
| `options` | object | | Style options (color, linewidth, etc.) |

#### `delete_drawing`
Removes a drawing from a chart layout.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `layoutId` | string | ✓ | Layout ID |
| `drawingId` | string | ✓ | Drawing ID |

---

### Pine Scripts

#### `list_scripts`
Returns your saved Pine Script indicators and strategies.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `orderBy` | string | | Sort field: `modified_time` (default), `views_count`, `description` |
| `limit` | number | | Max results (default 100) |

#### `get_script`
Returns the Pine Script source code for a saved script.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | string | ✓ | Script ID |
| `version` | string | | Script version (uses latest if omitted) |

---

### Account

#### `get_account`
Returns your TradingView account details — username, plan, reputation, follower counts, join date.

```
(no parameters)
```

#### `get_notification_settings`
Returns your alert notification settings (email, push, webhook configuration).

```
(no parameters)
```

---

### Session

#### `reset_session`
Clears the saved session from memory. The next tool call will trigger a fresh Playwright login.

```
(no parameters)
```

---

## Symbol Format

TradingView uses an `EXCHANGE:TICKER` format for all symbols:

| Asset | Example |
|-------|---------|
| US stocks | `NASDAQ:AAPL`, `NYSE:TSLA` |
| Crypto | `BINANCE:BTCUSDT`, `COINBASE:ETHUSD` |
| Forex | `FX:EURUSD`, `OANDA:GBPUSD` |
| Futures | `CME:ES1!`, `NYMEX:CL1!` |
| Indices | `SP:SPX`, `NASDAQ:NDX` |

---

## Project Structure

```
src/
├── index.ts       # MCP server entrypoint — tool definitions and request handlers
├── auth.ts        # Playwright login flow — opens headless browser, extracts cookies
├── session.ts     # Cookie persistence — save/load .tv_session.json with TTL check
├── client.ts      # HTTP client — fetch wrapper with cookie jar, CSRF, and subdomain support
├── types.ts       # Shared TypeScript interfaces
├── alerts.ts      # Alert CRUD
├── watchlists.ts  # Watchlist CRUD
├── market.ts      # Quotes, symbol search, symbol info
├── ohlcv.ts       # Historical OHLCV via TradingView WebSocket protocol
├── screener.ts    # Stock/crypto/forex screener
├── news.ts        # News headlines and community ideas
├── calendar.ts    # Economic calendar events
├── layouts.ts     # Chart layout management
├── drawings.ts    # Chart drawing management
├── scripts.ts     # Pine Script source retrieval
└── account.ts     # Account info and notification settings
```

---

## Troubleshooting

**Login fails / Playwright times out**

TradingView's login page varies by account type and may show a CAPTCHA or 2FA prompt. Try running with `headless: false` in `src/auth.ts` to watch the browser and identify what's blocking the flow.

**API requests return 403 or 401**

Your session has likely expired. Delete `.tv_session.json` (or call `reset_session`) to trigger a fresh login.

**API requests return 404 or unexpected response shapes**

TradingView's internal API is undocumented and may change. Open your browser's DevTools → Network tab, perform the action manually on tradingview.com, and compare the actual request URL and payload against the relevant file in `src/`.

**`get_ohlcv` times out**

The WebSocket connection to `data.tradingview.com` may be blocked by a firewall or the symbol may be invalid. Verify the symbol format using `search_symbols` first. The timeout is 30 seconds.

**`TV_USERNAME` / `TV_PASSWORD` not found**

When running via Claude Desktop, set credentials in the `env` block of your MCP config rather than relying on a `.env` file — the server process won't automatically source it.

---

## CI/CD

| Workflow | Trigger | Action |
|----------|---------|--------|
| `ci.yml` | Push to any branch, PRs to `main` | Typecheck + build; uploads `dist/` as a build artifact |
| `release.yml` | Push a `v*.*.*` tag | Build + create a GitHub Release with dist files attached |

To cut a release:

```bash
git tag v1.0.0
git push origin v1.0.0
```

---

## License

MIT
