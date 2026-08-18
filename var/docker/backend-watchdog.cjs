const { spawn } = require('node:child_process');

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
const maxRecoveryAttempts = Number(
  process.env.HAPPYM_BACKEND_WATCHDOG_MAX_RECOVERY_ATTEMPTS || 3
);
const recoveryGraceMs = Number(
  process.env.HAPPYM_BACKEND_WATCHDOG_RECOVERY_GRACE_MS || 45000
);

const decideRecoveryAction = (failures, recoveryAttempts) => {
  if (failures < failureThreshold) return 'wait';
  if (recoveryAttempts + 1 >= maxRecoveryAttempts) return 'terminate';
  return 'restart';
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

const restartBackend = () =>
  new Promise((resolve) => {
    const child = spawn('pm2', ['restart', 'backend', '--update-env'], {
      stdio: 'inherit',
    });
    child.once('exit', resolve);
    child.once('error', resolve);
  });

const run = async () => {
  let failures = 0;
  let recoveryAttempts = 0;
  let healthySince = 0;

  await delay(startupGraceMs);
  for (;;) {
    if (await probe()) {
      failures = 0;
      healthySince ||= Date.now();
      if (Date.now() - healthySince >= 300000) recoveryAttempts = 0;
      await delay(intervalMs);
      continue;
    }

    healthySince = 0;
    failures += 1;
    const action = decideRecoveryAction(failures, recoveryAttempts);
    if (action === 'wait') {
      await delay(intervalMs);
      continue;
    }

    recoveryAttempts += 1;
    failures = 0;
    if (action === 'terminate') {
      console.error(
        'Social Manager API recovery exhausted; terminating the container for orchestrator restart'
      );
      process.kill(1, 'SIGTERM');
      return;
    }

    console.warn('Social Manager API is unavailable; restarting the backend');
    await restartBackend();
    await delay(recoveryGraceMs);
  }
};

if (require.main === module) {
  run().catch(() => {
    console.error('Social Manager backend watchdog failed');
    process.kill(1, 'SIGTERM');
  });
}

module.exports = { decideRecoveryAction };
