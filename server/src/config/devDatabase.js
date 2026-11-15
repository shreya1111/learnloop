import { execFile, spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { connect } from "node:net";
import { setTimeout as delay } from "node:timers/promises";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const CONTAINER_NAME = "learnloop-mongo-dev";
const VOLUME_NAME = "learnloop-mongo-dev";
const MONGO_IMAGE = "mongo:8";
const MONGO_CONTAINER_PORT = 27017;
const DOCKER_START_TIMEOUT_MS = 120_000;
const MONGO_READY_TIMEOUT_MS = 60_000;
const LOOPBACK_HOSTS = new Set(["127.0.0.1", "localhost"]);

const dockerDesktopPaths = {
  win32: "C:\\Program Files\\Docker\\Docker\\Docker Desktop.exe",
  darwin: "/Applications/Docker.app",
};

/**
 * Returns the loopback address to watch, or null when this is not a local
 * development database (remote/Atlas URIs, production, or the opt-out).
 */
export function localMongoTarget(mongoUri, { nodeEnv, autoStart = true } = {}) {
  if (nodeEnv !== "development" || autoStart === false) {
    return null;
  }

  let parsed;
  try {
    parsed = new URL(mongoUri);
  } catch {
    return null;
  }

  if (parsed.protocol !== "mongodb:" || !LOOPBACK_HOSTS.has(parsed.hostname)) {
    return null;
  }

  const port = Number(parsed.port || MONGO_CONTAINER_PORT);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    return null;
  }

  return { host: "127.0.0.1", port };
}

function isPortOpen({ host, port }, timeoutMs = 1000) {
  return new Promise((resolve) => {
    const socket = connect({ host, port });
    let settled = false;
    const finish = (open) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve(open);
    };

    socket.setTimeout(timeoutMs);
    socket.once("connect", () => finish(true));
    socket.once("timeout", () => finish(false));
    socket.once("error", () => finish(false));
  });
}

async function dockerIsReady() {
  try {
    await execFileAsync("docker", ["info"], { timeout: 20_000 });
    return true;
  } catch {
    return false;
  }
}

async function launchDockerDesktop(log) {
  const executable = dockerDesktopPaths[process.platform];
  if (!executable || !existsSync(executable)) {
    return false;
  }

  log("[dev] Docker engine is not running; launching Docker Desktop");
  if (process.platform === "darwin") {
    spawn("open", ["-a", executable], { detached: true, stdio: "ignore" }).unref();
  } else {
    spawn(executable, [], { detached: true, stdio: "ignore" }).unref();
  }
  return true;
}

async function waitForDocker(log) {
  const deadline = Date.now() + DOCKER_START_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (await dockerIsReady()) {
      log("[dev] Docker engine is ready");
      return;
    }
    await delay(3000);
  }

  throw new Error(
    "Docker did not become ready in time. Start Docker Desktop, or point MONGODB_URI at a running database.",
  );
}

async function startContainer(target, log) {
  const exists = await execFileAsync("docker", ["inspect", CONTAINER_NAME], {
    timeout: 20_000,
  })
    .then(() => true)
    .catch(() => false);

  if (exists) {
    log(`[dev] Starting existing container ${CONTAINER_NAME}`);
    await execFileAsync("docker", ["start", CONTAINER_NAME], { timeout: 60_000 });
    return;
  }

  log(
    `[dev] Creating container ${CONTAINER_NAME} (${MONGO_IMAGE}) for ${target.host}:${target.port}`,
  );
  await execFileAsync(
    "docker",
    [
      "run",
      "-d",
      "--name",
      CONTAINER_NAME,
      "--restart",
      "unless-stopped",
      "-p",
      `${target.host}:${target.port}:${MONGO_CONTAINER_PORT}`,
      "-v",
      `${VOLUME_NAME}:/data/db`,
      MONGO_IMAGE,
    ],
    { timeout: 300_000 },
  );
}

async function waitForMongo(target) {
  const deadline = Date.now() + MONGO_READY_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (await isPortOpen(target)) {
      return;
    }
    await delay(1000);
  }

  throw new Error(
    `MongoDB never accepted connections on ${target.host}:${target.port}. Inspect it with: docker logs ${CONTAINER_NAME}`,
  );
}

/**
 * Makes sure a local development MongoDB is listening before the API connects.
 * Only acts on loopback URIs in development, and never hides a failure: if the
 * database cannot be started the error explains what to do next.
 */
export async function ensureDevDatabase({
  mongoUri,
  nodeEnv,
  autoStart = true,
  log = console.log,
} = {}) {
  const target = localMongoTarget(mongoUri, { nodeEnv, autoStart });
  if (!target) {
    return false;
  }

  if (await isPortOpen(target)) {
    return false;
  }

  log(
    `[dev] MongoDB is not running on ${target.host}:${target.port}; starting a local instance`,
  );

  if (!(await dockerIsReady())) {
    const launched = await launchDockerDesktop(log);
    if (!launched) {
      throw new Error(
        `MongoDB is not running on ${target.host}:${target.port} and Docker Desktop could not be started. Start Docker, or point MONGODB_URI at a running database.`,
      );
    }
    await waitForDocker(log);
  }

  await startContainer(target, log);
  await waitForMongo(target);
  log(`[dev] MongoDB is ready on ${target.host}:${target.port}`);
  return true;
}
