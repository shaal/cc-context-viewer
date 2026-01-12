# Claude Context Viewer

A real-time, browser-based viewer for Claude agent conversation context. View, search, filter, and export your Claude conversations with color-coded message types and a VS Code-style minimap.

![Claude Context Viewer](docs/screenshot.png)

## Features

- **Real-time Streaming** - Watch Claude's responses appear as they're generated
- **Color-coded Messages** - Instantly identify system prompts, tool calls, thinking, and responses
- **Virtual Scrolling** - Handle 200K+ token contexts without lag
- **Canvas Minimap** - Navigate long conversations with a VS Code-style overview
- **Search** - Find text across your entire conversation (Ctrl+F)
- **Filter** - Toggle visibility of specific message types
- **Zoom** - Adjust font size (Ctrl+Plus/Minus)
- **Export** - Save conversations as JSON, plain text, or HTML

## Quick Start

### Prerequisites

- Node.js 18+
- One of the following for API access:
  - An [Anthropic API key](https://console.anthropic.com/), OR
  - [cliproxyapi](https://github.com/yourusername/cliproxyapi) installed at `~/code/utilities/cliproxyapi`

### Global Installation (Recommended)

```bash
# Clone and install globally
git clone https://github.com/yourusername/claude-context-viewer.git
cd claude-context-viewer
npm install
npm link

# Now run from any project directory!
cd ~/my-awesome-project
ccv
```

### CLI Usage

```bash
# Start viewer in current directory
ccv

# Start with specific project directory
ccv ~/my-project

# Use custom port
ccv --port 3002

# Don't auto-open browser
ccv --no-open

# Show help
ccv --help
```

The project directory appears in the status bar and is used for all file operations (exports, etc.).

### Local Development

```bash
# Clone the repository
git clone https://github.com/yourusername/claude-context-viewer.git
cd claude-context-viewer

# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env and add your ANTHROPIC_API_KEY

# Development mode (both server and client)
npm run dev

# Or run separately:
npm run dev:server  # Backend on http://localhost:3001
npm run dev:client  # Frontend on http://localhost:5173
```

Open http://localhost:5173 in your browser.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      BROWSER                                │
│  ┌───────────────────────────────────────────────────────┐ │
│  │  Svelte Frontend                                       │ │
│  │  - Virtual scrolling for 200K+ tokens                 │ │
│  │  - Canvas minimap for navigation                      │ │
│  │  - Color-coded content blocks                         │ │
│  └───────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                         │ SSE (Server-Sent Events)
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                    NODE.JS SERVER                           │
│  ┌───────────────────────────────────────────────────────┐ │
│  │  Express + @anthropic-ai/sdk                          │ │
│  │  - Secure API key management                          │ │
│  │  - Streaming responses                                │ │
│  │  - Conversation state                                 │ │
│  └───────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

## Color Coding

| Type | Color | Description |
|------|-------|-------------|
| 🔵 System | Blue | System prompt and instructions |
| 🟢 Tools | Green | Available tool definitions |
| 🟡 User | Yellow | Your messages |
| 🟣 Thinking | Purple | Claude's reasoning (if enabled) |
| ⚪ Assistant | White | Claude's responses |
| 🟠 Tool Call | Orange | When Claude uses a tool |
| 🔴 Tool Result | Red | Tool execution results |
| ⬛ Error | Gray | Error messages |

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+F` | Focus search box |
| `Enter` | Next search match |
| `Shift+Enter` | Previous search match |
| `Esc` | Clear search |
| `Ctrl++` | Zoom in |
| `Ctrl+-` | Zoom out |
| `Ctrl+0` | Reset zoom |
| `Ctrl+Enter` | Send message |

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/chat` | POST | Send message (returns SSE stream) |
| `/api/context` | GET | Get full conversation context |
| `/api/context` | DELETE | Clear conversation |
| `/api/export/:format` | GET | Export (json/text/html) |
| `/api/tools` | GET | List available tools |
| `/health` | GET | Server health check |

## Configuration

Environment variables (`.env`):

```bash
# API Key - Choose one option:

# Option 1: Direct Anthropic API key
ANTHROPIC_API_KEY=sk-ant-api03-xxxxx

# Option 2: Use cliproxyapi (leave ANTHROPIC_API_KEY unset)
# The app auto-detects cliproxyapi at ~/code/utilities/cliproxyapi
# Customize with these optional variables:
# CLIPROXYAPI_URL=http://localhost:8318
# CLIPROXYAPI_PATH=~/code/utilities/cliproxyapi
# CLIPROXYAPI_PORT=8318

# Optional settings
PORT=3001                           # Server port
CLAUDE_MODEL=claude-sonnet-4-20250514  # Model to use
ENABLE_THINKING=true                # Enable extended thinking
```

### API Key Options

The application supports two methods for API authentication:

1. **Direct API Key**: Set `ANTHROPIC_API_KEY` in your `.env` file
2. **cliproxyapi**: If no API key is set, the app automatically looks for `cliproxyapi` at `~/code/utilities/cliproxyapi`. This proxy handles authentication based on your subscription.

The server startup message indicates which mode is active:
- `Using direct Anthropic API key`
- `Using cliproxyapi at http://localhost:8318`

## Project Structure

```
cc-context-viewer/
├── server/                    # Node.js backend
│   └── src/
│       ├── index.ts          # Express entry point
│       ├── routes/           # API route handlers
│       └── services/         # Claude SDK, context store
├── client/                    # Svelte frontend
│   └── src/
│       ├── routes/           # SvelteKit pages
│       └── lib/
│           ├── components/   # UI components
│           ├── stores/       # Svelte stores
│           └── types/        # TypeScript types
└── docs/
    └── plans/
        └── prd.md            # Product requirements
```

## Development

```bash
# Run in development mode
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Lint code
npm run lint
```

## Troubleshooting

### "Not configured - set ANTHROPIC_API_KEY or install cliproxyapi"
You need one of the following:

**Option 1: Set your API key**
```bash
cp .env.example .env
# Edit .env and add your ANTHROPIC_API_KEY
```

**Option 2: Install cliproxyapi**
```bash
# Clone cliproxyapi to the expected location
git clone https://github.com/yourusername/cliproxyapi ~/code/utilities/cliproxyapi
cd ~/code/utilities/cliproxyapi
# Follow cliproxyapi setup instructions
```

### Port already in use
Change the port in `.env`:
```bash
PORT=3002
```

### CORS errors
The server is configured to accept requests from `localhost:5173`. If you're running the client on a different port, update the CORS settings in `server/src/index.ts`.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests and linting
5. Submit a pull request

## License

MIT

## Acknowledgments

- Built with [Anthropic Claude SDK](https://github.com/anthropics/anthropic-sdk-typescript)
- UI powered by [Svelte](https://svelte.dev/) and [SvelteKit](https://kit.svelte.dev/)
