/**
 * @file apps/api/src/index.ts
 * @author Guy Romelle Magayano
 * @description API gateway bootstrap entrypoint.
 */

import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { getApiConfig } from "./config/env.js";
import { createApiLogger } from "./config/logger.js";
import { createServer } from "./server.js";

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
const workspaceRootDirectory = path.resolve(currentDirectory, "../../..");
const workspaceRootEnvLocalFile = path.join(
  workspaceRootDirectory,
  ".env.local"
);

if (existsSync(workspaceRootEnvLocalFile)) {
  const loadEnvFile = globalThis.process?.loadEnvFile;

  if (typeof loadEnvFile === "function") {
    loadEnvFile(workspaceRootEnvLocalFile);
  }
}

/** Starts the API gateway Node server for local and non-serverless runtimes. */
export function startApiServer(): void {
  const config = getApiConfig();
  const logger = createApiLogger(config.nodeEnv);
  const app = createServer();

  app.listen({
    port: config.port,
    hostname: "0.0.0.0",
  });

  logger.info("API gateway started", {
    port: config.port,
    nodeEnv: config.nodeEnv,
  });
}

/** Indicates whether this module is running as the process entrypoint. */
function isDirectExecution(): boolean {
  const entryFilePath = globalThis?.process?.argv?.[1];

  if (!entryFilePath) {
    return false;
  }

  try {
    return import.meta.url === pathToFileURL(entryFilePath).href;
  } catch {
    return false;
  }
}

export { default as vercelApiGatewayHandler } from "./platform/vercel.js";
export { createServer } from "./server.js";

if (isDirectExecution()) {
  startApiServer();
}
