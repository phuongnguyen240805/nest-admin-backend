Done in 4.3s

[nx-dev-entrypoint] Starting: pnpm nx serve-worker ladipage-backend --skip-nx-cache


> nx run ladipage-backend:serve-worker:development


NX Daemon is not running. Node process will not restart automatically after file changes.

> nx run ladipage-backend:build-worker:development

> webpack-cli build --config webpack.worker.config.js --node-env=development --externals-presets-node

Entrypoint main =

Entrypoint worker.main [big] 853 KiB (1.01 MiB) = worker.main.js 1 auxiliary asset

ERROR in main

Module not found: Error: Can't resolve './src' in '/app/apps/ladipage-backend'

webpack compiled with 1 error (5176aee2fdeadb86)

Warning: command "webpack-cli build --config webpack.worker.config.js --node-env=development --externals-presets-node" exited with non-zero status code


 NX   Running target build-worker for project ladipage-backend failed

Failed tasks:

- ladipage-backend:build-worker:development

Hint: run the command with --verbose for more details.

Build failed, waiting for changes to restart...