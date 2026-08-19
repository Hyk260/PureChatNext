# PureChat Desktop

This package is the Electron shell for the existing Vite SPA. The web
application remains the source of truth for routes and business UI.

## Development

Start the complete desktop development environment with:

```bash
pnpm dev:desktop
```

The command reuses or starts the shared Next BFF on port `3000`, then starts
the Electron renderer on port `5176`. The desktop renderer port is separate
from the browser SPA port `5174`.

To run only the Electron process, use:

```bash
pnpm dev:desktop:renderer
```

In that mode, start a compatible Next BFF separately. Override the renderer
port with `PURECHAT_DESKTOP_VITE_PORT` when running multiple instances.

## Packaging

```bash
pnpm --dir apps/desktop package:dir
pnpm --dir apps/desktop package:mac
pnpm --dir apps/desktop package:win
```

Production builds load the bundled renderer through the `purechat://renderer`
protocol. Set `PURECHAT_DESKTOP_REMOTE_URL` in the desktop process environment
or configure the remote server through the desktop bridge before using a
packaged build. The remote server must allow the `purechat://renderer` origin
when browser-style cross-origin requests are used.

OAuth PKCE, local databases, local model runtimes, and MCP process management
are intentionally separate follow-up work. The current bridge exposes only
the safe boundaries needed to add those capabilities without importing
Electron into the web application.
