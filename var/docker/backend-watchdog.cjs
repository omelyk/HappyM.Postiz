const probeUrl =
  process.env.HAPPYM_BACKEND_WATCHDOG_URL ||
  'http://127.0.0.1:3000/internal/happym/appliance/health/';
const intervalMs = Number(process.env.HAPPYM_BACKEND_WATCHDOG_INTERVAL_MS || 5000);
const startupGraceMs = Number(
  process.env.HAPPYM_BACKEND_WATCHDOG_STARTUP_GRACE_MS || 90000
);
const failureThreshold = Number(
  process.env.HAPPYM_BACKEND_WATCHDOG_FAILURE_THRESHOLD || 6
);
const decideRecoveryAction = (failures) => {
  if (failures < failureThreshold) return 'wait';
  return 'terminate';
};

const delay = (milliseconds) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

const probe = async () => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3000);
  try {
    // Any HTTP response proves Nest is serving. Readiness may legitimately be
    // false while a dependency is recovering and must not trigger a restart.
    await fetch(probeUrl, { signal: controller.signal });
    return true;
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
};

const run = async () => {
  let failures = 0;

  await delay(startupGraceMs);
  for (;;) {
    if (await probe()) {
      failures = 0;
      await delay(intervalMs);
      continue;
    }

    failures += 1;
    const action = decideRecoveryAction(failures);
    if (action === 'wait') {
      await delay(intervalMs);
      continue;
    }

    // pm2-runtime is the container's init process. Invoking the pm2 CLI from
    // inside one of its children starts a competing daemon and can leave the
    // old Nest process bound to port 3000 (EADDRINUSE), extending the outage.
    // Let the container supervisor perform one clean, atomic recovery instead.
    console.error(
      'Social Manager API is unavailable; terminating the container for a clean restart'
    );
    process.kill(1, 'SIGTERM');
    return;
  }
};

if (require.main === module) {
  run().catch(() => {
    console.error('Social Manager backend watchdog failed');
    process.kill(1, 'SIGTERM');
  });
}

module.exports = { decideRecoveryAction };
