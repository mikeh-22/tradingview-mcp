# tradingview-mcp

A [Model Context Protocol (MCP)](https://modelcontextprotocol.io) server that lets AI assistants manage your TradingView alerts and watchlists. Connect it to Claude Desktop, Cursor, or any MCP-compatible client and interact with TradingView using natural language.

> **Disclaimer:** This project uses TradingView's internal, undocumented web API. It is not affiliated with or endorsed by TradingView. API endpoints may change without notice. Use in accordance with TradingView's Terms of Service.

---

## How It Works

TradingView's desktop and web apps communicate with their backend over a private REST API. This server:

1. **Authenticates** using a headless Chromium browser (via [Playwright](https://playwright.dev)) to replicate the normal login flow and obtain valid session cookies.
2. **Persists** those cookies to disk so re-authentication only happens when the session expires (~25 days).
3. **Exposes MCP tools** that make authenticated HTTP requests to TradingView's internal endpoints for alerts and watchlists.

```
MCP Client (Claude, Cursor…)
        │  MCP protocol (stdio)
        ▼
  tradingview-mcp
        │  HTTPS + session cookies
        ▼
  tradingview.com API
```

---

## Features

- **Alerts** — list, get, create, update, enable/disable, and delete price alerts
- **Watchlists** — list, get, create, rename, add/remove symbols, and delete watchlists
- **Session persistence** — logs in once via headless browser, reuses cookies for subsequent runs
- **CSRF handling** — automatically reads and forwards the `csrftoken` cookie on mutating requests

---

## Requirements

- Node.js 18 or later
- A TradingView account (free tier is sufficient)

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
| `symbol` | string | ✓ | Symbol in `EXCHANGE:TICKER` format, e.g. `NASDAQ:AAPL` |
| `condition` | string | ✓ | Condition type, e.g. `crossing`, `greater_than`, `less_than` |
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
├── client.ts      # HTTP client — fetch wrapper with cookie jar and CSRF injection
├── alerts.ts      # Alert CRUD — thin wrappers around TradingView alert endpoints
├── watchlists.ts  # Watchlist CRUD — thin wrappers around watchlist endpoints
└── types.ts       # Shared TypeScript interfaces
```

---

## Troubleshooting

**Login fails / Playwright times out**

TradingView's login page varies by account type and may show a CAPTCHA or 2FA prompt. Try running with `headless: false` in `src/auth.ts` to watch the browser and identify what's blocking the flow.

**API requests return 403 or 401**

Your session has likely expired. Delete `.tv_session.json` (or call `reset_session`) to trigger a fresh login.

**API requests return 404 or unexpected shapes**

TradingView's internal API is undocumented and may change. Open your browser's DevTools → Network tab, perform the action manually on tradingview.com, and compare the actual request URL and payload against what's in `src/alerts.ts` / `src/watchlists.ts`.

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
