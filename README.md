# tradingview-mcp

An MCP (Model Context Protocol) server for managing TradingView alerts and watchlists. Works with any MCP-compatible client (Claude Desktop, Cursor, etc.).

## Features

- **Alerts** — list, create, update, enable/disable, and delete price alerts
- **Watchlists** — list, create, rename, add/remove symbols, and delete watchlists
- **Session management** — authenticates via Playwright headless browser, persists cookies for ~25 days

## Requirements

- Node.js 18+
- A TradingView account

## Setup

```bash
# Install dependencies
npm install

# Install Playwright's Chromium browser (used for login)
npx playwright install chromium

# Copy and fill in credentials
cp .env.example .env
```

Edit `.env`:

```env
TV_USERNAME=your_username_or_email
TV_PASSWORD=your_password
```

## Build & Run

```bash
npm run build
npm start
```

On first run, Playwright opens a headless browser, logs in, and saves session cookies to `.tv_session.json`. Subsequent runs reuse the saved session.

## Claude Desktop Integration

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "tradingview": {
      "command": "node",
      "args": ["/absolute/path/to/tradingview-mcp/dist/index.js"],
      "env": {
        "TV_USERNAME": "your_username",
        "TV_PASSWORD": "your_password"
      }
    }
  }
}
```

## Available Tools

### Alerts

| Tool | Description |
|------|-------------|
| `list_alerts` | List all active alerts |
| `get_alert` | Get a specific alert by ID |
| `create_alert` | Create a new price alert |
| `update_alert` | Modify an existing alert |
| `delete_alert` | Delete an alert |
| `enable_alert` | Activate an alert |
| `disable_alert` | Deactivate without deleting |

### Watchlists

| Tool | Description |
|------|-------------|
| `list_watchlists` | List all watchlists |
| `get_watchlist` | Get a watchlist and its symbols |
| `create_watchlist` | Create a new watchlist |
| `rename_watchlist` | Rename a watchlist |
| `add_symbols` | Add symbols to a watchlist |
| `remove_symbols` | Remove symbols from a watchlist |
| `delete_watchlist` | Delete a watchlist |

### Session

| Tool | Description |
|------|-------------|
| `reset_session` | Clear cached session and force re-login |

## Notes

- TradingView's internal API is undocumented and subject to change. If requests fail, use your browser's DevTools (Network tab) to verify the current endpoint paths and request shapes, then update `src/alerts.ts` / `src/watchlists.ts` accordingly.
- Symbols use TradingView's `EXCHANGE:TICKER` format, e.g. `NASDAQ:AAPL`, `NYSE:TSLA`, `BINANCE:BTCUSDT`.

## CI

GitHub Actions runs a typecheck and build on every push. Tagged releases (`v*.*.*`) automatically create a GitHub Release with the compiled `dist/`.

## License

MIT
