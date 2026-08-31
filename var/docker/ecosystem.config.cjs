module.exports = {
  apps: [
    {
      name: 'backend',
      cwd: '/app/apps/backend',
      script: 'pnpm',
      args: 'start:appliance',
      autorestart: true,
      restart_delay: 2000,
      exp_backoff_restart_delay: 100,
      max_restarts: 20,
      min_uptime: '10s',
      kill_timeout: 10000,
    },
    {
      name: 'frontend',
      cwd: '/app/apps/frontend',
      script: 'pnpm',
      args: 'start',
      autorestart: true,
      restart_delay: 2000,
      max_restarts: 20,
      min_uptime: '10s',
    },
    {
      name: 'orchestrator',
      cwd: '/app/apps/orchestrator',
      script: 'pnpm',
      args: 'start:appliance',
      // Temporal builds every workflow bundle concurrently during bootstrap.
      // Node 22.20 can abort in the Turboshaft/Turbofan compiler while that
      // burst is running. Keep the worker on the interpreter/baseline tiers;
      // its workload is I/O-bound and startup reliability matters more than
      // speculative optimization.
      autorestart: true,
      restart_delay: 2000,
      max_restarts: 20,
      min_uptime: '10s',
    },
    {
      name: 'backend-watchdog',
      cwd: '/app',
      script: '/app/var/docker/backend-watchdog.cjs',
      autorestart: true,
      restart_delay: 5000,
      max_restarts: 5,
      min_uptime: '10s',
    },
  ],
};
