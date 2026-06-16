.
├── README.md
├── RTK.md
├── __data
│   └── mysql
├── apps
│   ├── donut-sync-backend
│   │   ├── Dockerfile
│   │   ├── README.md
│   │   ├── docker-compose.yml
│   │   ├── eslint.config.mjs
│   │   ├── jest.config.cts
│   │   ├── nest-cli.json
│   │   ├── package.json
│   │   ├── project.json
│   │   ├── src
│   │   ├── structure.md
│   │   ├── tsconfig.app.json
│   │   ├── tsconfig.json
│   │   ├── tsconfig.spec.json
│   │   └── webpack.config.js
│   ├── ladipage-backend
│   │   ├── Dockerfile
│   │   ├── README.md
│   │   ├── eslint.config.mjs
│   │   ├── project.json
│   │   ├── routes.md
│   │   ├── src
│   │   ├── structure.md
│   │   ├── tsconfig.app.json
│   │   ├── tsconfig.json
│   │   └── webpack.config.js
│   └── nest-admin-backend
│       ├── Dockerfile
│       ├── README.md
│       ├── eslint.config.mjs
│       ├── project.json
│       ├── src
│       ├── tsconfig.app.json
│       ├── tsconfig.json
│       └── webpack.config.js
├── docker
│   ├── Dockerfile.base
│   ├── README.md
│   ├── __data
│   │   └── mysql
│   ├── deploy
│   │   └── sql
│   ├── docker-compose.prod.yml
│   ├── docker-compose.yml
│   └── nginx
│       └── default.conf
├── eslint.config.mjs
├── jest.config.ts
├── jest.migration.config.ts
├── jest.preset.js
├── libs
│   ├── database
│   │   ├── README.md
│   │   ├── eslint.config.mjs
│   │   ├── package.json
│   │   ├── project.json
│   │   ├── src
│   │   ├── tsconfig.cli.json
│   │   ├── tsconfig.json
│   │   └── tsconfig.lib.json
│   ├── dto
│   │   ├── README.md
│   │   ├── eslint.config.mjs
│   │   ├── package.json
│   │   ├── project.json
│   │   ├── src
│   │   ├── tsconfig.json
│   │   └── tsconfig.lib.json
│   ├── ladipage-types
│   │   ├── package.json
│   │   ├── src
│   │   └── tsconfig.json
│   ├── librefang-client
│   │   ├── eslint.config.mjs
│   │   ├── package.json
│   │   ├── project.json
│   │   ├── src
│   │   ├── tsconfig.json
│   │   └── tsconfig.lib.json
│   ├── nest-core
│   │   ├── README.md
│   │   ├── eslint.config.mjs
│   │   ├── package.json
│   │   ├── project.json
│   │   ├── src
│   │   ├── tsconfig.json
│   │   └── tsconfig.lib.json
│   ├── shared
│   │   ├── README.md
│   │   ├── eslint.config.mjs
│   │   ├── package.json
│   │   ├── project.json
│   │   ├── src
│   │   ├── tsconfig.json
│   │   └── tsconfig.lib.json
│   └── supabase
│       ├── package.json
│       ├── project.json
│       ├── src
│       ├── tsconfig.json
│       ├── tsconfig.lib.json
│       └── workflow.md
├── logs
│   ├── app-error.2026-06-14.log
│   ├── app-error.2026-06-15.log
│   ├── app-error.2026-06-16.log
│   ├── app.2026-06-14.log
│   ├── app.2026-06-15.log
│   └── app.2026-06-16.log
├── nx.json
├── package.json
├── plan.md
├── pnpm-lock.yaml
├── pnpm-workspace.yaml
├── scripts
│   ├── db
│   │   ├── api-smoke-test.js
│   │   ├── backfill-user-organizations.js
│   │   ├── check-db-state.js
│   │   ├── convert-mysql-seed-to-pg.js
│   │   ├── ladipage-tenant-smoke-test.js
│   │   ├── repair-migration-state.js
│   │   ├── run-migrations.js
│   │   ├── smoke-test.js
│   │   ├── validate-schema.js
│   │   └── validate-seed.js
│   ├── migration
│   │   ├── audit-mysql.js
│   │   ├── audit-pg.js
│   │   ├── backfill-supabase-users.js
│   │   ├── lib
│   │   ├── pgloader.load.template
│   │   ├── run-phase7.js
│   │   └── validate-cutover.js
│   └── test-stripe-webhook.sh
├── structure.md
├── sub-plan.md
├── tmp
│   └── libs
│       ├── database
│       ├── dto
│       ├── librefang-client
│       ├── nest-core
│       ├── shared
│       └── supabase
├── tsconfig.base.json
├── tsconfig.json
├── tsconfig.spec.json
├── turbo.json
└── workflow.md