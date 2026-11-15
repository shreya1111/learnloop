#!/usr/bin/env node
// Verifies a running LearnLoop deployment from the terminal.
//
//   node scripts/check-deploy.mjs https://your-app.up.railway.app
//   node scripts/check-deploy.mjs https://your-app.up.railway.app --api https://api.up.railway.app
//   WEB_URL=http://localhost:5173 node scripts/check-deploy.mjs
//
// Exits 0 when every check passes and 1 when any check fails.

const timeoutMs = 20000;

function usage() {
  console.error(
    [
      "Usage: node scripts/check-deploy.mjs <web-url> [--api <api-url>]",
      "",
      "  <web-url>   Public URL of the client (proxies /api to the API)",
      "  --api       Optional direct API URL, checked as well",
      "",
      "The URL can also come from WEB_URL; the API URL from API_URL.",
    ].join("\n"),
  );
}

const args = process.argv.slice(2);
let webUrl = process.env.WEB_URL ?? "";
let apiUrl = process.env.API_URL ?? "";

for (let index = 0; index < args.length; index += 1) {
  const arg = args[index];
  if (arg === "--api") {
    apiUrl = args[index + 1] ?? "";
    index += 1;
  } else if (arg === "--help" || arg === "-h") {
    usage();
    process.exit(0);
  } else if (!webUrl) {
    webUrl = arg;
  } else {
    console.error(`Unexpected argument: ${arg}`);
    usage();
    process.exit(2);
  }
}

if (!webUrl) {
  usage();
  process.exit(2);
}

const trimBase = (value) => value.replace(/\/+$/, "");
const web = trimBase(webUrl);
const api = apiUrl ? trimBase(apiUrl) : "";

async function request(url, options = {}) {
  const started = Date.now();
  try {
    const response = await fetch(url, {
      redirect: "manual",
      signal: AbortSignal.timeout(timeoutMs),
      ...options,
    });
    const body = await response.text();
    return { status: response.status, body, headers: response.headers, ms: Date.now() - started };
  } catch (error) {
    const reason = error?.name === "TimeoutError" ? "timed out" : (error?.cause?.code ?? error?.message ?? "request failed");
    return { status: 0, body: "", headers: new Headers(), ms: Date.now() - started, error: reason };
  }
}

function json(body) {
  try {
    return JSON.parse(body);
  } catch {
    return null;
  }
}

const results = [];

function record(name, ok, detail) {
  results.push({ name, ok, detail });
}

async function checkWebRoot() {
  const res = await request(`${web}/`);
  if (res.status === 0) return record("web root", false, `unreachable: ${res.error}`);
  const looksLikeApp = res.body.includes('<div id="root"') || res.body.includes("LearnLoop");
  record(
    "web root",
    res.status === 200 && looksLikeApp,
    res.status !== 200 ? `HTTP ${res.status}` : looksLikeApp ? `HTTP 200, ${res.ms} ms` : "HTTP 200 but the page is not the LearnLoop shell",
  );
}

async function checkSpaRoute() {
  const res = await request(`${web}/dashboard`);
  const isHtml = (res.headers.get("content-type") ?? "").includes("text/html");
  record(
    "SPA fallback",
    res.status === 200 && isHtml,
    res.status === 0 ? `unreachable: ${res.error}` : `HTTP ${res.status}${isHtml ? "" : " (not HTML)"} — /dashboard must serve index.html`,
  );
}

async function checkApiThroughWeb() {
  const res = await request(`${web}/api/health`);
  if (res.status === 0) return record("api via web", false, `unreachable: ${res.error}`);
  const payload = json(res.body)?.data;
  const healthy = res.status === 200 && payload?.status === "ok";
  record(
    "api via web",
    healthy,
    res.status !== 200
      ? `HTTP ${res.status} — the web proxy could not reach the API`
      : healthy
        ? `HTTP 200, ${payload.service ?? "api"} database ${payload.database ?? "?"}, ${res.ms} ms`
        : `HTTP 200 but status=${payload?.status ?? "?"} database=${payload?.database ?? "?"}`,
  );
}

async function checkAuthGuard() {
  const res = await request(`${web}/api/auth/me`);
  // 401 signed out, 200 signed in — both prove the route is reachable and the
  // session cookie is being parsed rather than erroring.
  const ok = res.status === 401 || res.status === 200;
  record("auth route", ok, res.status === 0 ? `unreachable: ${res.error}` : `HTTP ${res.status} (401 expected when signed out)`);
}

async function checkDirectApi() {
  const res = await request(`${api}/api/health`);
  const payload = json(res.body)?.data;
  record(
    "api direct",
    res.status === 200 && payload?.status === "ok",
    res.status === 0 ? `unreachable: ${res.error}` : `HTTP ${res.status} status=${payload?.status ?? "?"} database=${payload?.database ?? "?"}`,
  );
}

await checkWebRoot();
await checkSpaRoute();
await checkApiThroughWeb();
await checkAuthGuard();
if (api) await checkDirectApi();

const width = Math.max(...results.map((item) => item.name.length));
console.log(`\nChecking ${web}${api ? ` (api ${api})` : ""}\n`);
for (const item of results) {
  console.log(`${item.ok ? "PASS" : "FAIL"}  ${item.name.padEnd(width)}  ${item.detail}`);
}

const failures = results.filter((item) => !item.ok);
console.log(`\n${results.length - failures.length}/${results.length} checks passed`);
if (failures.length > 0) {
  console.log("See README.md → Deploy on Railway → Troubleshooting for the failing case.");
  process.exit(1);
}
