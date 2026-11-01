// Basic load test (R9, PRD 6): fires GET requests at one URL with fixed concurrency and prints
// throughput, errors and latency percentiles. No dependencies.
//
// Usage: node scripts/load-test.mjs <url> [--concurrency 20] [--requests 500]
// Only localhost unless --allow-remote is passed, so it cannot hammer someone else's site by mistake.
// Numbers from `next dev` are not representative; use `pnpm build && pnpm start` for real figures.

const print = (line) => process.stdout.write(`${line}\n`);
const fail = (line) => {
  process.stderr.write(`${line}\n`);
  process.exit(2);
};

const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const index = args.indexOf(`--${name}`);
  return index === -1 ? fallback : Number(args[index + 1]);
};
const url = args.find((arg) => /^https?:\/\//.test(arg));
const concurrency = flag("concurrency", 20);
const total = flag("requests", 500);

if (!url) {
  fail("Usage: node scripts/load-test.mjs <url> [--concurrency 20] [--requests 500]");
}
const host = new URL(url).hostname;
if (!["localhost", "127.0.0.1", "::1"].includes(host) && !args.includes("--allow-remote")) {
  fail(`Refusing to load-test ${host}. Pass --allow-remote only for a server you own.`);
}
if (!(concurrency > 0 && total > 0)) {
  fail("--concurrency and --requests must be positive numbers.");
}

const latencies = [];
const statuses = new Map();
let errors = 0;
let next = 0;

async function worker() {
  while (next < total) {
    next++;
    const started = performance.now();
    try {
      const response = await fetch(url, { redirect: "manual" });
      await response.arrayBuffer();
      statuses.set(response.status, (statuses.get(response.status) ?? 0) + 1);
      if (response.status >= 500) errors++;
    } catch {
      errors++;
    }
    latencies.push(performance.now() - started);
  }
}

const startedAt = performance.now();
await Promise.all(Array.from({ length: concurrency }, worker));
const seconds = (performance.now() - startedAt) / 1000;

latencies.sort((a, b) => a - b);
const pct = (p) => latencies[Math.min(latencies.length - 1, Math.floor((p / 100) * latencies.length))]?.toFixed(0) ?? "-";

print(`URL          ${url}`);
print(`Requests     ${latencies.length} at concurrency ${concurrency} in ${seconds.toFixed(1)} s`);
print(`Throughput   ${(latencies.length / seconds).toFixed(1)} req/s`);
print(`Latency ms   p50 ${pct(50)}  p95 ${pct(95)}  p99 ${pct(99)}  max ${latencies.at(-1)?.toFixed(0) ?? "-"}`);
print(`Statuses     ${[...statuses].map(([status, count]) => `${status}: ${count}`).join(", ") || "none"}`);
print(`Errors       ${errors}`);
process.exit(errors > 0 ? 1 : 0);
