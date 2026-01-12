#!/usr/bin/env node

/**
 * Claude Context Viewer CLI
 *
 * Run from any directory to view Claude conversation context
 * with that directory as the project root.
 *
 * Usage:
 *   ccv                    # Start with current directory as project root
 *   ccv --port 3002        # Use custom port
 *   ccv --no-open          # Don't auto-open browser
 *   ccv /path/to/project   # Specify project directory
 */

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join, resolve } from 'path';
import { existsSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT_DIR = join(__dirname, '..');

// Parse command line arguments
function parseArgs(args) {
  const options = {
    projectDir: process.cwd(),
    port: 3001,
    clientPort: 5173,
    open: true,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--port' || arg === '-p') {
      options.port = parseInt(args[++i], 10);
    } else if (arg === '--client-port') {
      options.clientPort = parseInt(args[++i], 10);
    } else if (arg === '--no-open') {
      options.open = false;
    } else if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    } else if (arg === '--version' || arg === '-v') {
      printVersion();
      process.exit(0);
    } else if (!arg.startsWith('-')) {
      // Positional argument is project directory
      const resolvedPath = resolve(arg);
      if (existsSync(resolvedPath)) {
        options.projectDir = resolvedPath;
      } else {
        console.error(`Error: Directory not found: ${arg}`);
        process.exit(1);
      }
    }
  }

  return options;
}

function printHelp() {
  console.log(`
Claude Context Viewer - Real-time viewer for Claude agent conversations

Usage:
  ccv [options] [project-directory]

Options:
  -p, --port <port>      Server port (default: 3001)
  --client-port <port>   Client dev server port (default: 5173)
  --no-open              Don't auto-open browser
  -h, --help             Show this help message
  -v, --version          Show version number

Examples:
  ccv                    Start in current directory
  ccv ~/my-project       Start with specific project directory
  ccv --port 3002        Use custom server port
`);
}

function printVersion() {
  try {
    const pkg = JSON.parse(
      require('fs').readFileSync(join(ROOT_DIR, 'package.json'), 'utf-8')
    );
    console.log(`Claude Context Viewer v${pkg.version}`);
  } catch {
    console.log('Claude Context Viewer v1.0.0');
  }
}

function openBrowser(url) {
  const platform = process.platform;
  let cmd;

  if (platform === 'darwin') {
    cmd = 'open';
  } else if (platform === 'win32') {
    cmd = 'start';
  } else {
    cmd = 'xdg-open';
  }

  spawn(cmd, [url], { detached: true, stdio: 'ignore' }).unref();
}

async function main() {
  const options = parseArgs(process.argv.slice(2));

  console.log(`
╔════════════════════════════════════════════════════════════╗
║           Claude Context Viewer - CLI                      ║
╠════════════════════════════════════════════════════════════╣
║  Project: ${options.projectDir.slice(-47).padEnd(47)}║
║  Server:  http://localhost:${String(options.port).padEnd(29)}║
║  Client:  http://localhost:${String(options.clientPort).padEnd(29)}║
╚════════════════════════════════════════════════════════════╝
`);

  // Set environment variables
  const env = {
    ...process.env,
    PROJECT_DIR: options.projectDir,
    PORT: String(options.port),
    VITE_PORT: String(options.clientPort),
  };

  // Start server
  const serverProcess = spawn('npm', ['run', 'dev:server'], {
    cwd: ROOT_DIR,
    env,
    stdio: 'inherit',
  });

  // Give server time to start
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Start client
  const clientProcess = spawn('npm', ['run', 'dev:client'], {
    cwd: ROOT_DIR,
    env,
    stdio: 'inherit',
  });

  // Open browser after client starts
  if (options.open) {
    setTimeout(() => {
      const url = `http://localhost:${options.clientPort}`;
      console.log(`\n🌐 Opening ${url} in browser...\n`);
      openBrowser(url);
    }, 3000);
  }

  // Handle cleanup
  const cleanup = () => {
    console.log('\n\nShutting down...');
    serverProcess.kill();
    clientProcess.kill();
    process.exit(0);
  };

  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);

  // Keep process running
  await new Promise(() => {});
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
