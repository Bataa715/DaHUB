module.exports = {
  apps: [
    {
      name: 'backend',
      cwd: '/app/backend',
      script: 'dist/main.js',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT: '3001',
        DATABASE_URL: 'file:/app/backend/prisma/dev.db',
      },
      error_file: '/app/logs/backend-error.log',
      out_file: '/app/logs/backend-out.log',
      merge_logs: true,
      autorestart: true,
      max_memory_restart: '500M',
    },
    {
      name: 'frontend',
      cwd: '/app/frontend',
      script: 'apps/nextn/server.js',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT: '9002',
        HOSTNAME: '0.0.0.0',
        NEXT_PUBLIC_API_URL: 'http://localhost:3001',
      },
      error_file: '/app/logs/frontend-error.log',
      out_file: '/app/logs/frontend-out.log',
      merge_logs: true,
      autorestart: true,
      max_memory_restart: '500M',
    },
  ],
};
