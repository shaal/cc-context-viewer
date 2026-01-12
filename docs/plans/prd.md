# Claude Context Viewer - Product Requirements Document

## Overview

Claude Context Viewer is a production-ready browser-based application that displays and interacts with Claude agent conversation context in real-time. Built with Svelte for the frontend and Node.js with the official `@anthropic-ai/sdk` for the backend, it provides a high-performance, color-coded view of all message types with support for contexts up to 200K tokens.

## Goals

1. **Real-time streaming visibility** - Display the complete agent context as it evolves
2. **High performance at scale** - Handle 200K token contexts (800KB+ of text) without lag
3. **Clear visual categorization** - Color-code different content types for easy parsing
4. **Developer-friendly** - Support debugging, inspection, and export of agent interactions
5. **Browser-native** - No desktop installation required, works in any modern browser

## Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                           BROWSER                                   │
│                                                                     │
│  ┌───────────────────────────────────────────────────────────────┐ │
│  │                    Svelte Application                          │ │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐   │ │
│  │  │   Toolbar   │  │   Filters   │  │   Search + Zoom     │   │ │
│  │  └─────────────┘  └─────────────┘  └─────────────────────┘   │ │
│  │  ┌─────────────────────────────────────────────────────────┐ │ │
│  │  │            Virtual Scroll Container                     │ │ │
│  │  │  ┌─────────────────────────────────────────────────┐   │ │ │
│  │  │  │  Only ~30-50 DOM nodes rendered at any time    │   │ │ │
│  │  │  │  Recycles nodes as user scrolls                │   │ │ │
│  │  │  └─────────────────────────────────────────────────┘   │ │ │
│  │  └─────────────────────────────────────────────────────────┘ │ │
│  │  ┌─────────────────────────────────────────────────────────┐ │ │
│  │  │            Agent Input Panel                            │ │ │
│  │  │  [ User message input box ] [Send] [Stop]               │ │ │
│  │  └─────────────────────────────────────────────────────────┘ │ │
│  └───────────────────────────────────────────────────────────────┘ │
│                              │                                      │
│  ┌───────────────────────────▼───────────────────────────────────┐ │
│  │                    Web Worker                                  │ │
│  │  - Parses streaming chunks without blocking UI                │ │
│  │  - Builds incremental search index                            │ │
│  │  - Calculates virtual scroll positions                        │ │
│  └───────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
                              │
                    Server-Sent Events (SSE)
                    or WebSocket connection
                              │
┌─────────────────────────────────────────────────────────────────────┐
│                        NODE.JS SERVER                               │
│                                                                     │
│  ┌───────────────────────────────────────────────────────────────┐ │
│  │  Express/Fastify + @anthropic-ai/sdk                          │ │
│  │                                                                │ │
│  │  POST /api/chat         - Send message, stream response       │ │
│  │  GET  /api/context      - Get current conversation context    │ │
│  │  POST /api/context/clear - Clear conversation                 │ │
│  │  GET  /api/tools        - List available tools                │ │
│  │                                                                │ │
│  │  ┌─────────────────────────────────────────────────────────┐ │ │
│  │  │  Claude SDK Client                                       │ │ │
│  │  │  - Manages API key securely (never exposed to browser)  │ │ │
│  │  │  - Handles streaming with proper backpressure           │ │ │
│  │  │  - Maintains conversation state                         │ │ │
│  │  └─────────────────────────────────────────────────────────┘ │ │
│  └───────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
```

## Technical Requirements

### Backend (Node.js)

#### Dependencies
```json
{
  "@anthropic-ai/sdk": "^0.30.0",
  "express": "^4.18.0",
  "cors": "^2.8.0",
  "dotenv": "^16.0.0"
}
```

#### API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/chat` | POST | Send user message, returns SSE stream |
| `/api/context` | GET | Get full conversation context |
| `/api/context` | DELETE | Clear conversation |
| `/api/tools` | GET | List configured tools |
| `/api/export/:format` | GET | Export context (json/text/html) |

#### Streaming Protocol
- Use Server-Sent Events (SSE) for streaming responses
- Event types mirror Claude SDK events:
  - `message_start` - New assistant message beginning
  - `content_block_start` - New content block (text, tool_use, thinking)
  - `content_block_delta` - Incremental content update
  - `content_block_stop` - Content block complete
  - `message_stop` - Full message complete
  - `error` - Error occurred

### Frontend (Svelte)

#### Dependencies
```json
{
  "svelte": "^4.0.0",
  "@sveltejs/kit": "^2.0.0",
  "svelte-virtual-list": "^3.0.0"
}
```

#### Key Components

1. **ContextViewer** - Main container with virtual scrolling
2. **ContextBlock** - Individual message/block renderer
3. **Toolbar** - Refresh, export, settings buttons
4. **SearchBar** - Search input with match navigation
5. **FilterPanel** - Content type toggle buttons
6. **ZoomControl** - Font size slider/buttons
7. **AgentInput** - User message input and send button
8. **StatusBar** - Connection status, message count, token usage
9. **ContextMinimap** - Canvas-based overview sidebar (like VS Code)

### Color Coding Scheme

| Content Type | Background | Text | Border |
|--------------|------------|------|--------|
| System Prompt | `#E3F2FD` (light blue) | `#1565C0` | `#1976D2` |
| Tool Definitions | `#E8F5E9` (light green) | `#2E7D32` | `#43A047` |
| User Messages | `#FFFDE7` (light yellow) | `#F57F17` | `#FBC02D` |
| Assistant Thinking | `#F3E5F5` (light purple) | `#7B1FA2` | `#9C27B0` |
| Tool Calls | `#FFF3E0` (light orange) | `#E65100` | `#FB8C00` |
| Tool Results | `#FFEBEE` (light red) | `#C62828` | `#EF5350` |
| Assistant Response | `#FFFFFF` (white) | `#212121` | `#E0E0E0` |
| Errors | `#ECEFF1` (gray) | `#D32F2F` | `#F44336` |

### Performance Requirements

#### Virtual Scrolling
- Render only visible items + small buffer (overscan)
- Target: 30-50 DOM nodes maximum regardless of context size
- Smooth scrolling at 60fps
- Accurate scroll position and height estimation

#### Memory Management
- Maximum 50MB browser memory for 200K token context
- Lazy loading of collapsed content
- Garbage collection friendly data structures

#### Responsiveness
- UI interactions respond within 16ms (60fps)
- Search results appear within 100ms
- Filter changes apply within 50ms

### Web Worker Architecture

The parsing bottleneck is handled by offloading CPU-intensive work to a **Web Worker** (separate thread):

```
┌─────────────────────────────────────────────────────────────────┐
│                     MAIN THREAD (UI)                            │
│  - Renders DOM                                                  │
│  - Handles user input                                           │
│  - Manages virtual scroll position                              │
│  - Receives parsed data from worker                             │
└─────────────────────────────────────────────────────────────────┘
              │ postMessage()          │ onmessage
              ▼                        ▲
┌─────────────────────────────────────────────────────────────────┐
│                    WEB WORKER (Background Thread)               │
│                                                                 │
│  Responsibilities:                                              │
│  ├── Parse incoming SSE stream chunks                          │
│  ├── Detect content types (system, tool_use, thinking, etc.)   │
│  ├── Build incremental search index (inverted index)           │
│  ├── Calculate estimated heights for virtual scroll            │
│  ├── Filter/transform data based on active filters             │
│  └── Batch updates to minimize main thread communication       │
│                                                                 │
│  Message Types:                                                 │
│  IN:  { type: 'parse', chunk: string }                         │
│  IN:  { type: 'search', query: string }                        │
│  IN:  { type: 'filter', activeTypes: ContentType[] }           │
│  OUT: { type: 'blocks', data: ContextBlock[] }                 │
│  OUT: { type: 'searchResults', matches: SearchMatch[] }        │
└─────────────────────────────────────────────────────────────────┘
```

#### Worker Benefits
- **Non-blocking parsing**: 200K tokens can be parsed without freezing UI
- **Incremental indexing**: Search index built as data streams in
- **Batched updates**: Groups rapid updates to reduce main thread overhead
- **Transferable objects**: Use `ArrayBuffer` for large data to avoid copying

#### Implementation Notes
```typescript
// Main thread
const worker = new Worker(new URL('./parser.worker.ts', import.meta.url));

worker.postMessage({ type: 'parse', chunk: incomingData });

worker.onmessage = (e) => {
  if (e.data.type === 'blocks') {
    contextStore.update(blocks => [...blocks, ...e.data.data]);
  }
};

// Worker thread (parser.worker.ts)
self.onmessage = (e) => {
  if (e.data.type === 'parse') {
    const parsed = parseChunk(e.data.chunk);
    self.postMessage({ type: 'blocks', data: parsed });
  }
};
```

### Features

#### 1. Real-time Streaming Display
- Show content as it arrives from Claude
- Visual indicator for active streaming (pulsing dot/border)
- Smooth scroll-to-bottom during streaming (can be disabled)

#### 2. Content Block Rendering
- Collapsible sections for long content
- Syntax highlighting for code blocks
- Formatted JSON for tool calls/results
- Markdown rendering for text content

#### 3. Search Functionality
- Real-time search as you type
- Highlight all matches across visible content
- Navigate between matches (Next/Previous)
- Show match count and current position
- Keyboard shortcuts: Ctrl+F to focus, Enter for next, Shift+Enter for previous

#### 4. Filtering
- Toggle visibility by content type
- Multiple filters can be active simultaneously
- Filter badges show count per type
- Keyboard shortcuts: 1-8 for quick toggles

#### 5. Zoom/Font Size
- Range: 10px to 28px (default 14px)
- Ctrl+Plus/Minus keyboard shortcuts
- Ctrl+Mouse wheel support
- Zoom level persisted in localStorage

#### 6. Export
- **JSON**: Full structured data with metadata
- **Text**: Human-readable formatted output
- **HTML**: Self-contained file with styles and syntax highlighting

#### 7. Agent Interaction
- Text input for sending user messages
- Stop button to cancel ongoing generation
- Clear conversation button
- Message history navigation (optional)

#### 8. Canvas Minimap (Overview Sidebar)
A GPU-accelerated bird's-eye view of the entire conversation, inspired by VS Code's minimap.

```
┌──────────────────────────────────────────┬─────┐
│                                          │█████│ ← System (blue)
│     Main Context Viewer                  │     │
│     (DOM + Virtual Scroll)               │░░░░░│ ← User (yellow)
│                                          │█████│ ← Assistant (white)
│                                          │▓▓▓▓▓│ ← Tool Call (orange)
│     [Currently visible area]             │▓▓▓▓▓│ ← Tool Result (red)
│                                          │█████│ ← Thinking (purple)
│                                          │     │
│                                          │░░░░░│ ← User
│                                          │█████│ ← Assistant
│                                          │ ◄── │ Viewport indicator
└──────────────────────────────────────────┴─────┘
                                            80px
```

**Minimap Features:**
- **Canvas 2D rendering**: Draws colored rectangles representing blocks (no text)
- **Proportional sizing**: Block height proportional to content length
- **Click-to-jump**: Click anywhere to scroll main view to that position
- **Drag viewport**: Drag the viewport indicator for precise navigation
- **Real-time updates**: Redraws as new content streams in
- **Search highlights**: Shows orange markers for search matches
- **Filter sync**: Respects active filters, hides filtered-out types
- **Responsive width**: 60-100px, collapsible on narrow screens

**Implementation Notes:**
```typescript
// Minimap rendering (simplified)
function drawMinimap(ctx: CanvasRenderingContext2D, blocks: ContextBlock[]) {
  const scale = canvas.height / totalContentHeight;
  let y = 0;

  for (const block of blocks) {
    ctx.fillStyle = COLORS[block.type].background;
    const height = Math.max(2, block.estimatedHeight * scale);
    ctx.fillRect(0, y, canvas.width, height);
    y += height;
  }

  // Draw viewport indicator
  ctx.strokeStyle = '#1976D2';
  ctx.lineWidth = 2;
  ctx.strokeRect(0, viewportTop * scale, canvas.width, viewportHeight * scale);
}
```

## File Structure

```
cc-context-viewer/
├── README.md
├── package.json                    # Root workspace config
├── .env.example                    # Environment template
│
├── server/                         # Node.js backend
│   ├── package.json
│   ├── tsconfig.json
│   ├── src/
│   │   ├── index.ts               # Express app entry
│   │   ├── routes/
│   │   │   ├── chat.ts            # /api/chat endpoint
│   │   │   ├── context.ts         # /api/context endpoints
│   │   │   └── export.ts          # /api/export endpoints
│   │   ├── services/
│   │   │   ├── claude-client.ts   # Anthropic SDK wrapper
│   │   │   ├── context-store.ts   # In-memory context storage
│   │   │   └── streaming.ts       # SSE streaming utilities
│   │   └── types/
│   │       └── index.ts           # Shared type definitions
│   └── tests/
│
├── client/                         # Svelte frontend
│   ├── package.json
│   ├── svelte.config.js
│   ├── vite.config.ts
│   ├── src/
│   │   ├── app.html
│   │   ├── app.css                # Global styles
│   │   ├── routes/
│   │   │   └── +page.svelte       # Main page
│   │   ├── lib/
│   │   │   ├── components/
│   │   │   │   ├── ContextViewer.svelte
│   │   │   │   ├── ContextBlock.svelte
│   │   │   │   ├── ContextMinimap.svelte  # Canvas-based overview
│   │   │   │   ├── Toolbar.svelte
│   │   │   │   ├── SearchBar.svelte
│   │   │   │   ├── FilterPanel.svelte
│   │   │   │   ├── ZoomControl.svelte
│   │   │   │   ├── AgentInput.svelte
│   │   │   │   └── StatusBar.svelte
│   │   │   ├── stores/
│   │   │   │   ├── context.ts     # Context state store
│   │   │   │   ├── filters.ts     # Filter state store
│   │   │   │   └── settings.ts    # User settings store
│   │   │   ├── utils/
│   │   │   │   ├── parser.ts      # Content type detection
│   │   │   │   ├── search.ts      # Search utilities
│   │   │   │   └── export.ts      # Client-side export
│   │   │   └── types/
│   │   │       └── index.ts
│   │   └── workers/
│   │       └── parser.worker.ts   # Web Worker for parsing
│   ├── static/
│   │   └── favicon.png
│   └── tests/
│
└── docs/
    └── plans/
        └── prd.md                  # This document
```

## Data Structures

### Context Block
```typescript
interface ContextBlock {
  id: string;                      // Unique identifier
  type: ContentType;               // See enum below
  content: string;                 // Raw content
  timestamp: string;               // ISO timestamp
  metadata?: {
    model?: string;                // For assistant messages
    toolName?: string;             // For tool_use/tool_result
    inputTokens?: number;
    outputTokens?: number;
    stopReason?: string;
  };
  isStreaming?: boolean;           // Currently being streamed
  isCollapsed?: boolean;           // UI state
  estimatedHeight?: number;        // For virtual scroll
}

enum ContentType {
  SYSTEM = 'system',
  TOOL_DEFINITION = 'tool_definition',
  USER = 'user',
  ASSISTANT_THINKING = 'thinking',
  ASSISTANT_TEXT = 'text',
  TOOL_USE = 'tool_use',
  TOOL_RESULT = 'tool_result',
  ERROR = 'error'
}
```

### SSE Event Format
```typescript
// Server sends:
event: content_block_delta
data: {"blockId":"abc123","delta":"Hello","type":"text"}

event: message_stop
data: {"messageId":"msg_123","stopReason":"end_turn"}
```

## Installation & Usage

### Prerequisites
- Node.js 18+
- npm or pnpm
- Anthropic API key

### Quick Start
```bash
# Clone the repository
git clone <repo-url>
cd cc-context-viewer

# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env and add your ANTHROPIC_API_KEY

# Start development servers
npm run dev
# Server: http://localhost:3001
# Client: http://localhost:5173
```

### Production Build
```bash
npm run build
npm start
```

## Success Criteria

1. [ ] Application loads and connects to Claude API
2. [ ] Full conversation context displayed with correct color coding
3. [ ] Streaming responses update in real-time without lag
4. [ ] 200K token context scrolls smoothly at 60fps
5. [ ] Search finds and highlights matches within 100ms
6. [ ] Filters show/hide content types correctly
7. [ ] Zoom works across full range with persistence
8. [ ] All three export formats produce valid output
9. [ ] No browser memory issues with large contexts
10. [ ] Canvas minimap shows accurate overview and syncs with scroll
11. [ ] Click-to-jump on minimap navigates to correct position
12. [ ] Works in Chrome, Firefox, Safari, Edge

## Future Enhancements (Out of Scope v1)

- Multi-conversation tabs
- Context diff view between snapshots
- Token usage visualization charts
- Cost estimation
- Conversation branching visualization
- Plugin system for custom renderers
- WebSocket option (instead of SSE)
- Offline support with IndexedDB persistence
