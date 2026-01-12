/**
 * Claude API Client
 *
 * Wraps the official Anthropic SDK to provide streaming responses
 * and manage conversation state. Handles all communication with the
 * Claude API.
 *
 * Supports two modes:
 * 1. Direct API key via ANTHROPIC_API_KEY environment variable
 * 2. Fallback to cliproxyapi at ~/code/utilities/cliproxyapi when no key provided
 */

import Anthropic from '@anthropic-ai/sdk';
import type { MessageParam, ContentBlock, ToolUseBlock, TextBlock } from '@anthropic-ai/sdk/resources/messages';
import { existsSync, readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join, resolve, dirname } from 'path';
import { homedir } from 'os';
import { execSync, spawn } from 'child_process';
import { glob } from 'glob';
import { contextStore } from './context-store.js';
import { ContentType, type ToolDefinition } from '../types/index.js';

/**
 * Default cliproxyapi configuration
 */
const DEFAULT_CLIPROXYAPI_PATH = join(homedir(), 'code/utilities/CLIProxyAPI');
const DEFAULT_CLIPROXYAPI_PORT = 8317;

/**
 * Checks if cliproxyapi is available and returns the URL if so
 */
function getClipProxyUrl(): string | null {
  // Check for explicit URL override
  if (process.env.CLIPROXYAPI_URL) {
    return process.env.CLIPROXYAPI_URL;
  }

  // Check if cliproxyapi exists at the expected path
  const proxyPath = process.env.CLIPROXYAPI_PATH || DEFAULT_CLIPROXYAPI_PATH;
  const binaryPath = join(proxyPath, 'cli-proxy-api');

  if (existsSync(binaryPath)) {
    const port = process.env.CLIPROXYAPI_PORT || DEFAULT_CLIPROXYAPI_PORT;
    return `http://localhost:${port}`;
  }

  return null;
}

/**
 * API mode - either direct API key or proxy
 */
type ApiMode = 'direct' | 'proxy' | 'unconfigured';

// Working directory for file operations
let workingDirectory = process.cwd();

// Agentic tools for file operations, bash execution, etc.
const DEFAULT_TOOLS: ToolDefinition[] = [
  {
    name: 'Read',
    description: 'Read the contents of a file. Use this to examine existing files.',
    input_schema: {
      type: 'object',
      properties: {
        file_path: {
          type: 'string',
          description: 'The path to the file to read (absolute or relative to working directory)',
        },
        offset: {
          type: 'number',
          description: 'Optional line number to start reading from (1-indexed)',
        },
        limit: {
          type: 'number',
          description: 'Optional number of lines to read',
        },
      },
      required: ['file_path'],
    },
  },
  {
    name: 'Write',
    description: 'Write content to a file, creating it if it does not exist or overwriting if it does.',
    input_schema: {
      type: 'object',
      properties: {
        file_path: {
          type: 'string',
          description: 'The path to the file to write',
        },
        content: {
          type: 'string',
          description: 'The content to write to the file',
        },
      },
      required: ['file_path', 'content'],
    },
  },
  {
    name: 'Edit',
    description: 'Edit a file by replacing a specific string with a new string. The old_string must match exactly.',
    input_schema: {
      type: 'object',
      properties: {
        file_path: {
          type: 'string',
          description: 'The path to the file to edit',
        },
        old_string: {
          type: 'string',
          description: 'The exact string to find and replace',
        },
        new_string: {
          type: 'string',
          description: 'The string to replace it with',
        },
      },
      required: ['file_path', 'old_string', 'new_string'],
    },
  },
  {
    name: 'Bash',
    description: 'Execute a bash command and return the output. Use for running commands, scripts, git operations, etc.',
    input_schema: {
      type: 'object',
      properties: {
        command: {
          type: 'string',
          description: 'The bash command to execute',
        },
        timeout: {
          type: 'number',
          description: 'Optional timeout in milliseconds (default: 30000)',
        },
      },
      required: ['command'],
    },
  },
  {
    name: 'Glob',
    description: 'Find files matching a glob pattern. Returns list of matching file paths.',
    input_schema: {
      type: 'object',
      properties: {
        pattern: {
          type: 'string',
          description: 'The glob pattern to match (e.g., "**/*.ts", "src/**/*.js")',
        },
        path: {
          type: 'string',
          description: 'Optional directory to search in (defaults to working directory)',
        },
      },
      required: ['pattern'],
    },
  },
  {
    name: 'Grep',
    description: 'Search for a pattern in files. Returns matching lines with file paths and line numbers.',
    input_schema: {
      type: 'object',
      properties: {
        pattern: {
          type: 'string',
          description: 'The regex pattern to search for',
        },
        path: {
          type: 'string',
          description: 'Optional file or directory to search in',
        },
        glob: {
          type: 'string',
          description: 'Optional glob pattern to filter files (e.g., "*.ts")',
        },
      },
      required: ['pattern'],
    },
  },
  {
    name: 'LS',
    description: 'List files and directories in a path.',
    input_schema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'The directory path to list (defaults to working directory)',
        },
      },
      required: [],
    },
  },
];

// Default system prompt
const DEFAULT_SYSTEM_PROMPT = `You are a helpful AI coding assistant with access to the user's filesystem and shell. You can read, write, and edit files, execute bash commands, and search the codebase.

Available tools:
- Read: Read file contents
- Write: Create or overwrite files
- Edit: Make precise edits by replacing exact strings
- Bash: Execute shell commands
- Glob: Find files by pattern
- Grep: Search file contents
- LS: List directory contents

When asked to build or modify software:
1. First explore the codebase using LS, Glob, and Read
2. Make changes using Write or Edit
3. Use Bash to run tests, install dependencies, or execute scripts

Be proactive - actually create and modify files rather than just showing code.`;

/**
 * Type for streaming event callbacks
 */
export interface StreamCallbacks {
  onMessageStart: (messageId: string, model: string) => void;
  onContentBlockStart: (blockId: string, blockType: ContentType, toolName?: string, toolId?: string) => void;
  onContentBlockDelta: (blockId: string, delta: string) => void;
  onContentBlockStop: (blockId: string) => void;
  onMessageStop: (messageId: string, stopReason: string, inputTokens: number, outputTokens: number) => void;
  onToolResult: (toolId: string, toolName: string, result: string) => void;
  onError: (error: Error) => void;
}

class ClaudeClient {
  private client: Anthropic;
  private model: string;
  private messages: MessageParam[] = [];
  private systemPrompt: string;
  private tools: ToolDefinition[];
  private enableThinking: boolean;
  private apiMode: ApiMode;
  private proxyUrl: string | null = null;

  constructor() {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    this.proxyUrl = getClipProxyUrl();

    if (apiKey) {
      // Direct API key provided
      this.client = new Anthropic({ apiKey });
      this.apiMode = 'direct';
    } else if (this.proxyUrl) {
      // Use cliproxyapi fallback
      // The proxy requires a valid API key that matches its auth configuration
      const proxyKey = process.env.CLIPROXYAPI_KEY || 'cliproxyapi';
      this.client = new Anthropic({
        baseURL: this.proxyUrl,
        apiKey: proxyKey,
      });
      this.apiMode = 'proxy';
    } else {
      // No configuration available - create placeholder client
      // Will fail on actual API calls but allows app to start
      this.client = new Anthropic({
        apiKey: 'not-configured',
      });
      this.apiMode = 'unconfigured';
    }

    this.model = process.env.CLAUDE_MODEL || 'claude-sonnet-4-20250514';
    this.enableThinking = process.env.ENABLE_THINKING === 'true';
    this.systemPrompt = DEFAULT_SYSTEM_PROMPT;
    this.tools = DEFAULT_TOOLS;
  }

  /**
   * Gets the current API mode
   */
  getApiMode(): ApiMode {
    return this.apiMode;
  }

  /**
   * Gets the proxy URL if using proxy mode
   */
  getProxyUrl(): string | null {
    return this.proxyUrl;
  }

  /**
   * Initializes the context store with system prompt and tools
   */
  initialize(systemPrompt?: string, tools?: ToolDefinition[]): void {
    if (systemPrompt) {
      this.systemPrompt = systemPrompt;
    }
    if (tools) {
      this.tools = tools;
    }

    // Store in context for display
    contextStore.setSystemPrompt(this.systemPrompt);
    contextStore.setTools(this.tools);
  }

  /**
   * Sends a message and streams the response
   */
  async sendMessage(userMessage: string, callbacks: StreamCallbacks): Promise<void> {
    // Add user message to context
    contextStore.addBlock(ContentType.USER, userMessage);

    // Add to conversation history
    this.messages.push({
      role: 'user',
      content: userMessage,
    });

    try {
      // Create streaming message request
      const streamParams: Anthropic.MessageCreateParams = {
        model: this.model,
        max_tokens: 8192,
        system: this.systemPrompt,
        messages: this.messages,
        tools: this.tools.map(t => ({
          name: t.name,
          description: t.description,
          input_schema: t.input_schema as Anthropic.Tool['input_schema'],
        })),
        stream: true,
      };

      // Add thinking if enabled and model supports it
      if (this.enableThinking && this.model.includes('claude-3-5')) {
        // Note: Extended thinking requires specific API parameters
        // This is a placeholder - adjust based on actual SDK support
      }

      const stream = this.client.messages.stream(streamParams);

      let currentBlockId: string | null = null;
      let messageId: string | null = null;
      let blockIndex = 0;
      const blockMap = new Map<number, string>(); // Maps API block index to our block ID

      // Handle stream events using streamEvent for raw SSE events
      stream.on('message', (message) => {
        messageId = message.id;
        callbacks.onMessageStart(message.id, message.model);
      });

      stream.on('streamEvent', (event) => {
        // Handle content_block_start
        if (event.type === 'content_block_start') {
          const idx = event.index;
          const contentBlock = event.content_block;

          let blockType: ContentType;
          let toolName: string | undefined;
          let toolId: string | undefined;

          if (contentBlock.type === 'tool_use') {
            blockType = ContentType.TOOL_USE;
            toolName = contentBlock.name;
            toolId = contentBlock.id;
          } else if ((contentBlock as { type: string }).type === 'thinking') {
            blockType = ContentType.ASSISTANT_THINKING;
          } else {
            blockType = ContentType.ASSISTANT_TEXT;
          }

          // Create streaming block in context store
          const block = contextStore.createStreamingBlock(blockType, {
            toolName,
            toolId,
            messageId: messageId || undefined,
          });

          currentBlockId = block.id;
          blockMap.set(idx, block.id);
          callbacks.onContentBlockStart(block.id, blockType, toolName, toolId);
        }

        // Handle content_block_delta
        if (event.type === 'content_block_delta') {
          const blockId = blockMap.get(event.index);
          if (!blockId) return;

          let delta = '';
          const deltaObj = event.delta as unknown as Record<string, string>;
          if (deltaObj.type === 'text_delta') {
            delta = deltaObj.text;
          } else if (deltaObj.type === 'thinking_delta') {
            delta = deltaObj.thinking;
          } else if (deltaObj.type === 'input_json_delta') {
            delta = deltaObj.partial_json;
          }

          if (delta) {
            contextStore.appendToBlock(blockId, delta);
            callbacks.onContentBlockDelta(blockId, delta);
          }
        }

        // Handle content_block_stop
        if (event.type === 'content_block_stop') {
          const blockId = blockMap.get(event.index);
          if (blockId) {
            contextStore.finalizeBlock(blockId);
            callbacks.onContentBlockStop(blockId);
          }
        }
      });

      // Wait for the stream to complete
      const finalMessage = await stream.finalMessage();

      // Update token usage
      contextStore.updateTokenUsage(
        finalMessage.usage.input_tokens,
        finalMessage.usage.output_tokens
      );

      callbacks.onMessageStop(
        finalMessage.id,
        finalMessage.stop_reason || 'end_turn',
        finalMessage.usage.input_tokens,
        finalMessage.usage.output_tokens
      );

      // Add assistant response to conversation history
      this.messages.push({
        role: 'assistant',
        content: finalMessage.content,
      });

      // Handle tool use if needed
      if (finalMessage.stop_reason === 'tool_use') {
        await this.handleToolUse(finalMessage.content, callbacks);
      }

    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      contextStore.addBlock(ContentType.ERROR, err.message);
      callbacks.onError(err);
    }
  }

  /**
   * Handles tool use by executing tools and continuing conversation
   */
  private async handleToolUse(
    content: ContentBlock[],
    callbacks: StreamCallbacks
  ): Promise<void> {
    const toolUseBlocks = content.filter(
      (block): block is ToolUseBlock => block.type === 'tool_use'
    );

    const toolResults: Array<{
      type: 'tool_result';
      tool_use_id: string;
      content: string;
    }> = [];

    for (const toolUse of toolUseBlocks) {
      const result = await this.executeTool(toolUse.name, toolUse.input as Record<string, unknown>);

      // Add tool result to context
      contextStore.addBlock(ContentType.TOOL_RESULT, result, {
        toolName: toolUse.name,
        toolId: toolUse.id,
      });

      // Send tool result via SSE callback
      callbacks.onToolResult(toolUse.id, toolUse.name, result);

      toolResults.push({
        type: 'tool_result',
        tool_use_id: toolUse.id,
        content: result,
      });
    }

    // Add tool results to conversation and continue
    this.messages.push({
      role: 'user',
      content: toolResults,
    });

    // Continue conversation after tool use
    await this.sendMessage('', callbacks);
  }

  /**
   * Resolves a file path relative to the working directory
   */
  private resolvePath(filePath: string): string {
    if (filePath.startsWith('/')) {
      return filePath;
    }
    if (filePath.startsWith('~')) {
      return join(homedir(), filePath.slice(1));
    }
    return resolve(workingDirectory, filePath);
  }

  /**
   * Executes a tool and returns the result
   */
  private async executeTool(
    name: string,
    input: Record<string, unknown>
  ): Promise<string> {
    try {
      switch (name) {
        case 'Read': {
          const filePath = this.resolvePath(input.file_path as string);
          if (!existsSync(filePath)) {
            return `Error: File not found: ${filePath}`;
          }
          const content = readFileSync(filePath, 'utf-8');
          const lines = content.split('\n');
          const offset = (input.offset as number) || 1;
          const limit = (input.limit as number) || lines.length;
          const selectedLines = lines.slice(offset - 1, offset - 1 + limit);
          // Format with line numbers
          return selectedLines
            .map((line, idx) => `${String(offset + idx).padStart(6)}│${line}`)
            .join('\n');
        }

        case 'Write': {
          const filePath = this.resolvePath(input.file_path as string);
          const content = input.content as string;
          // Ensure directory exists
          const dir = dirname(filePath);
          if (!existsSync(dir)) {
            execSync(`mkdir -p "${dir}"`);
          }
          writeFileSync(filePath, content, 'utf-8');
          return `Successfully wrote ${content.length} bytes to ${filePath}`;
        }

        case 'Edit': {
          const filePath = this.resolvePath(input.file_path as string);
          if (!existsSync(filePath)) {
            return `Error: File not found: ${filePath}`;
          }
          const oldString = input.old_string as string;
          const newString = input.new_string as string;
          let content = readFileSync(filePath, 'utf-8');

          if (!content.includes(oldString)) {
            return `Error: old_string not found in file. Make sure it matches exactly.`;
          }

          const occurrences = content.split(oldString).length - 1;
          if (occurrences > 1) {
            return `Error: old_string found ${occurrences} times. It must be unique. Add more context.`;
          }

          content = content.replace(oldString, newString);
          writeFileSync(filePath, content, 'utf-8');
          return `Successfully edited ${filePath}`;
        }

        case 'Bash': {
          const command = input.command as string;
          const timeout = (input.timeout as number) || 30000;
          try {
            const output = execSync(command, {
              cwd: workingDirectory,
              timeout,
              encoding: 'utf-8',
              maxBuffer: 10 * 1024 * 1024,
              shell: '/bin/bash',
            });
            return output || '(command completed with no output)';
          } catch (error: unknown) {
            const execError = error as { stdout?: string; stderr?: string; message?: string };
            if (execError.stdout || execError.stderr) {
              return `${execError.stdout || ''}${execError.stderr || ''}`;
            }
            return `Error: ${execError.message || String(error)}`;
          }
        }

        case 'Glob': {
          const pattern = input.pattern as string;
          const searchPath = input.path ? this.resolvePath(input.path as string) : workingDirectory;
          const matches = await glob(pattern, {
            cwd: searchPath,
            nodir: false,
            dot: true,
          });
          if (matches.length === 0) {
            return 'No files found matching pattern';
          }
          return matches.slice(0, 100).join('\n') + (matches.length > 100 ? `\n... and ${matches.length - 100} more` : '');
        }

        case 'Grep': {
          const pattern = input.pattern as string;
          const searchPath = input.path ? this.resolvePath(input.path as string) : workingDirectory;
          const fileGlob = input.glob as string | undefined;

          let cmd = `grep -rn "${pattern.replace(/"/g, '\\"')}" "${searchPath}"`;
          if (fileGlob) {
            cmd += ` --include="${fileGlob}"`;
          }
          cmd += ' 2>/dev/null || true';

          try {
            const output = execSync(cmd, {
              cwd: workingDirectory,
              encoding: 'utf-8',
              maxBuffer: 10 * 1024 * 1024,
            });
            if (!output.trim()) {
              return 'No matches found';
            }
            const lines = output.trim().split('\n');
            return lines.slice(0, 50).join('\n') + (lines.length > 50 ? `\n... and ${lines.length - 50} more matches` : '');
          } catch {
            return 'No matches found';
          }
        }

        case 'LS': {
          const dirPath = input.path ? this.resolvePath(input.path as string) : workingDirectory;
          if (!existsSync(dirPath)) {
            return `Error: Directory not found: ${dirPath}`;
          }
          const entries = readdirSync(dirPath);
          const detailed = entries.map(entry => {
            const fullPath = join(dirPath, entry);
            try {
              const stat = statSync(fullPath);
              const type = stat.isDirectory() ? 'd' : '-';
              const size = stat.isDirectory() ? '-' : String(stat.size);
              return `${type} ${size.padStart(10)} ${entry}`;
            } catch {
              return `? ${entry}`;
            }
          });
          return detailed.join('\n') || '(empty directory)';
        }

        default:
          return `Tool "${name}" not implemented`;
      }
    } catch (error) {
      return `Error executing tool ${name}: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  /**
   * Clears the conversation history
   */
  clear(): void {
    this.messages = [];
    contextStore.clear();
    // Re-initialize with system prompt and tools
    this.initialize();
  }

  /**
   * Gets the available tools
   */
  getTools(): ToolDefinition[] {
    return this.tools;
  }

  /**
   * Sets a custom system prompt
   */
  setSystemPrompt(prompt: string): void {
    this.systemPrompt = prompt;
    contextStore.clear();
    this.initialize();
  }

  /**
   * Checks if the client is properly configured
   */
  isConfigured(): boolean {
    return this.apiMode !== 'unconfigured';
  }

  /**
   * Gets a human-readable description of the current configuration
   */
  getConfigurationStatus(): string {
    switch (this.apiMode) {
      case 'direct':
        return 'Using direct Anthropic API key';
      case 'proxy':
        return `Using cliproxyapi at ${this.proxyUrl}`;
      case 'unconfigured':
        return 'Not configured - set ANTHROPIC_API_KEY or install cliproxyapi';
    }
  }
}

// Singleton instance
export const claudeClient = new ClaudeClient();

/**
 * Sets the working directory for file operations
 */
export function setWorkingDirectory(dir: string): void {
  workingDirectory = dir;
}

/**
 * Gets the current working directory
 */
export function getWorkingDirectory(): string {
  return workingDirectory;
}
