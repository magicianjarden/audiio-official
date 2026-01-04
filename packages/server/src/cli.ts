#!/usr/bin/env node
/**
 * Audiio Standalone Server - CLI Entry Point
 *
 * Run your own Audiio server anywhere:
 * - Docker container
 * - NAS/home server
 * - Cloud VM
 * - Raspberry Pi
 *
 * Usage:
 *   audiio-server                    # Start with defaults
 *   audiio-server --port 9000        # Custom port
 *   audiio-server --config ./my.yml  # Custom config
 *   audiio-server --init             # Generate example config
 */

import { loadConfig, generateExampleConfig, ServerConfig } from './config';
import { StandaloneServer } from './standalone-server';
import * as fs from 'fs';

// Parse command line arguments
function parseArgs(): {
  configPath?: string;
  port?: number;
  host?: string;
  init?: boolean;
  help?: boolean;
  version?: boolean;
} {
  const args = process.argv.slice(2);
  const result: ReturnType<typeof parseArgs> = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    switch (arg) {
      case '--config':
      case '-c':
        result.configPath = args[++i];
        break;
      case '--port':
      case '-p':
        result.port = parseInt(args[++i] || '8484', 10);
        break;
      case '--host':
      case '-h':
        if (args[i + 1] && !args[i + 1]?.startsWith('-')) {
          result.host = args[++i] || '0.0.0.0';
        } else {
          result.help = true;
        }
        break;
      case '--init':
        result.init = true;
        break;
      case '--help':
        result.help = true;
        break;
      case '--version':
      case '-v':
        result.version = true;
        break;
    }
  }

  return result;
}

function printHelp(): void {
  console.log(`
Audiio Standalone Server

Usage: audiio-server [options]

Options:
  -c, --config <path>   Path to config file (YAML or JSON)
  -p, --port <port>     Server port (default: 8484)
  -h, --host <host>     Server host (default: 0.0.0.0)
      --init            Generate example config file
      --help            Show this help message
  -v, --version         Show version

Environment Variables:
  AUDIIO_PORT           Server port
  AUDIIO_HOST           Server host
  AUDIIO_PLUGINS_DIR    Plugins directory
  AUDIIO_DATABASE       Database file path
  AUDIIO_CACHE_DIR      Cache directory
  AUDIIO_RELAY_ENABLED  Enable P2P relay (true/false)
  AUDIIO_RELAY_URL      Custom relay server URL
  AUDIIO_LOG_LEVEL      Log level (debug, info, warn, error)

Examples:
  audiio-server                           # Start with defaults
  audiio-server --port 9000               # Custom port
  audiio-server --config ./config.yml     # Use config file
  audiio-server --init                    # Generate config.yml
  AUDIIO_PORT=9000 audiio-server          # Port via env var

Docker:
  docker run -d \\
    -p 8484:8484 \\
    -v audiio-data:/data \\
    audiio/server

For more info: https://github.com/audiio/audiio
`);
}

function printVersion(): void {
  console.log('Audiio Server v0.1.0');
}

async function main(): Promise<void> {
  const args = parseArgs();

  if (args.help) {
    printHelp();
    process.exit(0);
  }

  if (args.version) {
    printVersion();
    process.exit(0);
  }

  if (args.init) {
    const configContent = generateExampleConfig();
    fs.writeFileSync('config.yml', configContent);
    console.log('Generated config.yml');
    console.log('\nEdit the file and run: audiio-server --config config.yml');
    process.exit(0);
  }

  // Load configuration
  let config: ServerConfig;
  try {
    config = loadConfig({ configPath: args.configPath });

    // Override with CLI args
    if (args.port) {
      config.server.port = args.port;
    }
    if (args.host) {
      config.server.host = args.host;
    }
  } catch (error) {
    console.error('Failed to load configuration:', error);
    process.exit(1);
  }

  // Create and start server
  const server = new StandaloneServer({
    config,
    onReady: (info) => {
      console.log(`\nServer ready at ${info.localUrl}`);
      if (info.p2pCode) {
        console.log(`P2P Code: ${info.p2pCode}`);
      }
    }
  });

  // Handle shutdown
  const shutdown = async (signal: string) => {
    console.log(`\n${signal} received, shutting down...`);
    await server.stop();
    process.exit(0);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  // Handle uncaught errors
  process.on('uncaughtException', (error) => {
    console.error('Uncaught exception:', error);
    process.exit(1);
  });

  process.on('unhandledRejection', (reason) => {
    console.error('Unhandled rejection:', reason);
    process.exit(1);
  });

  // Start server
  try {
    await server.start();
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Run CLI
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
