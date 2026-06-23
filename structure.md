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
│   │   │   ├── app.controller.spec.ts
│   │   │   ├── app.controller.ts
│   │   │   ├── app.module.ts
│   │   │   ├── app.service.ts
│   │   │   ├── assets
│   │   │   ├── auth
│   │   │   │   ├── auth.guard.ts
│   │   │   │   └── user-context.interface.ts
│   │   │   ├── main.ts
│   │   │   └── sync
│   │   │       ├── dto
│   │   │       ├── internal.controller.ts
│   │   │       ├── sync.controller.ts
│   │   │       ├── sync.module.ts
│   │   │       └── sync.service.ts
│   │   ├── structure.md
│   │   ├── tsconfig.app.json
│   │   ├── tsconfig.json
│   │   ├── tsconfig.spec.json
│   │   └── webpack.config.js
│   ├── ladipage-backend
│   │   ├── Dockerfile
│   │   ├── README.md
│   │   ├── crm-architecture.md
│   │   ├── eslint.config.mjs
│   │   ├── libs
│   │   │   └── api-types
│   │   │       ├── package.json
│   │   │       ├── src
│   │   │       └── tsconfig.json
│   │   ├── project.json
│   │   ├── routes.md
│   │   ├── src
│   │   │   ├── app
│   │   │   │   ├── app.controller.ts
│   │   │   │   ├── app.module.ts
│   │   │   │   └── app.service.ts
│   │   │   ├── assets
│   │   │   ├── common
│   │   │   │   ├── README.md
│   │   │   │   ├── decorators
│   │   │   │   ├── dto
│   │   │   │   ├── entities
│   │   │   │   ├── filters
│   │   │   │   ├── index.ts
│   │   │   │   ├── interceptors
│   │   │   │   ├── pipes
│   │   │   │   ├── services
│   │   │   │   └── utils
│   │   │   ├── main.ts
│   │   │   └── modules
│   │   │       ├── analytics
│   │   │       ├── builder-bridge
│   │   │       ├── credit
│   │   │       ├── crm
│   │   │       ├── dashboard
│   │   │       ├── domain
│   │   │       ├── ecom-store
│   │   │       ├── file-manager
│   │   │       ├── flowise
│   │   │       ├── funnelx
│   │   │       ├── payment
│   │   │       ├── plan
│   │   │       ├── publish
│   │   │       ├── sdk
│   │   │       ├── settings
│   │   │       └── website
│   │   ├── structure.md
│   │   ├── tsconfig.app.json
│   │   ├── tsconfig.json
│   │   └── webpack.config.js
│   ├── librefang-backend
│   │   └── libs
│   │       └── librefang-client
│   │           ├── eslint.config.mjs
│   │           ├── package.json
│   │           ├── project.json
│   │           ├── src
│   │           ├── tsconfig.json
│   │           └── tsconfig.lib.json
│   └── nest-admin-backend
│       ├── Dockerfile
│       ├── README.md
│       ├── eslint.config.mjs
│       ├── project.json
│       ├── src
│       │   ├── app
│       │   │   ├── app.controller.ts
│       │   │   ├── app.module.ts
│       │   │   └── app.service.ts
│       │   ├── assets
│       │   └── main.ts
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
│   │       ├── nest_admin.pg.sql
│   │       ├── nest_admin.sql
│   │       └── supabase
│   │           ├── 01-extensions.sql
│   │           └── 02-rls-phase6.sql
│   ├── docker-compose.prod.yml
│   ├── docker-compose.yml
│   └── nginx
│       └── default.conf
├── document.md
├── dynamic-analytis.md
├── eslint.config.mjs
├── jest.config.ts
├── jest.migration.config.ts
├── jest.preset.js
├── libs
│   ├── crm-core
│   │   ├── jest.config.js
│   │   ├── package.json
│   │   ├── project.json
│   │   ├── src
│   │   │   ├── __mocks__
│   │   │   │   ├── nest-core-paginate.ts
│   │   │   │   └── nest-core.ts
│   │   │   ├── config
│   │   │   │   ├── crm.config.ts
│   │   │   │   ├── custom-field.config.ts
│   │   │   │   └── enterprise.config.ts
│   │   │   ├── crm-core.module.ts
│   │   │   ├── index.ts
│   │   │   ├── services
│   │   │   │   ├── activity.service.spec.ts
│   │   │   │   ├── activity.service.ts
│   │   │   │   ├── company.service.ts
│   │   │   │   ├── crm-tenant-scoped.service.ts
│   │   │   │   ├── custom-field.service.spec.ts
│   │   │   │   ├── custom-field.service.ts
│   │   │   │   ├── dynamic-record.service.ts
│   │   │   │   ├── index.ts
│   │   │   │   ├── note.service.ts
│   │   │   │   ├── object-definition.service.spec.ts
│   │   │   │   ├── object-definition.service.ts
│   │   │   │   ├── opportunity.service.spec.ts
│   │   │   │   ├── opportunity.service.ts
│   │   │   │   ├── person.service.spec.ts
│   │   │   │   ├── person.service.ts
│   │   │   │   ├── pipeline.service.spec.ts
│   │   │   │   ├── pipeline.service.ts
│   │   │   │   └── task.service.ts
│   │   │   └── utils
│   │   │       ├── company-from-domain.ts
│   │   │       ├── contact-entries.spec.ts
│   │   │       ├── contact-entries.ts
│   │   │       ├── custom-field-validation.spec.ts
│   │   │       ├── custom-field-validation.ts
│   │   │       ├── dedupe-contacts.spec.ts
│   │   │       ├── dedupe-contacts.ts
│   │   │       ├── dynamic-record-validation.spec.ts
│   │   │       ├── dynamic-record-validation.ts
│   │   │       ├── email-domain.spec.ts
│   │   │       ├── email-domain.ts
│   │   │       ├── index.ts
│   │   │       ├── match-participant.ts
│   │   │       ├── parse-name.spec.ts
│   │   │       └── parse-name.ts
│   │   ├── tsconfig.json
│   │   ├── tsconfig.lib.json
│   │   └── tsconfig.spec.json
│   ├── database
│   │   ├── README.md
│   │   ├── eslint.config.mjs
│   │   ├── package.json
│   │   ├── project.json
│   │   ├── src
│   │   │   ├── base.entity.d.ts
│   │   │   ├── base.entity.ts
│   │   │   ├── config
│   │   │   │   └── database.config.ts
│   │   │   ├── constraints
│   │   │   │   ├── entity-exist.constraint.ts
│   │   │   │   ├── unique.constraint.d.ts
│   │   │   │   └── unique.constraint.ts
│   │   │   ├── data-source.ts
│   │   │   ├── database.module.ts
│   │   │   ├── entities
│   │   │   │   └── crm
│   │   │   ├── env.d.ts
│   │   │   ├── global
│   │   │   │   ├── env.ts
│   │   │   │   └── index.ts
│   │   │   ├── index.ts
│   │   │   ├── migrations
│   │   │   │   ├── 1741000000000-baseline-postgres.ts
│   │   │   │   ├── 1741000001000-seed-initial-data.ts
│   │   │   │   ├── 1752000000000-phase0-tenant-org-bridge.ts
│   │   │   │   ├── 1752000001000-ecom-store.ts
│   │   │   │   ├── 1752000002000-crm.ts
│   │   │   │   ├── 1752000003000-ecom-store-extensions.ts
│   │   │   │   ├── 1753000002000-crm-core.ts
│   │   │   │   ├── 1753000003000-crm-sales.ts
│   │   │   │   ├── 1753000004000-crm-order-person.ts
│   │   │   │   ├── 1753000005000-crm-custom-fields.ts
│   │   │   │   ├── 1753000006000-crm-enterprise.ts
│   │   │   │   ├── 1753000007000-crm-person-tag-segment-bridge.ts
│   │   │   │   └── archive
│   │   │   ├── typeorm-cli.util.spec.ts
│   │   │   ├── typeorm-cli.util.ts
│   │   │   ├── typeorm-logger.ts
│   │   │   └── utils
│   │   │       ├── connection-url.util.spec.ts
│   │   │       └── connection-url.util.ts
│   │   ├── tsconfig.cli.json
│   │   ├── tsconfig.json
│   │   └── tsconfig.lib.json
│   ├── dto
│   │   ├── README.md
│   │   ├── eslint.config.mjs
│   │   ├── package.json
│   │   ├── project.json
│   │   ├── src
│   │   │   ├── cursor.dto.ts
│   │   │   ├── delete.dto.ts
│   │   │   ├── id.dto.ts
│   │   │   ├── index.ts
│   │   │   ├── operator.dto.d.ts
│   │   │   ├── operator.dto.ts
│   │   │   ├── pager.dto.d.ts
│   │   │   └── pager.dto.ts
│   │   ├── tsconfig.json
│   │   └── tsconfig.lib.json
│   ├── nest-core
│   │   ├── README.md
│   │   ├── eslint.config.mjs
│   │   ├── package.json
│   │   ├── project.json
│   │   ├── src
│   │   │   ├── assets
│   │   │   │   └── templates
│   │   │   ├── common
│   │   │   │   ├── adapters
│   │   │   │   ├── decorators
│   │   │   │   ├── dto
│   │   │   │   ├── entities
│   │   │   │   ├── entity
│   │   │   │   ├── exceptions
│   │   │   │   ├── filters
│   │   │   │   ├── guards
│   │   │   │   ├── index.ts
│   │   │   │   ├── interceptors
│   │   │   │   ├── model
│   │   │   │   ├── pipes
│   │   │   │   └── services
│   │   │   ├── config
│   │   │   │   ├── app.config.ts
│   │   │   │   ├── database.config.ts
│   │   │   │   ├── index.ts
│   │   │   │   ├── mailer.config.ts
│   │   │   │   ├── oss.config.ts
│   │   │   │   ├── redis.config.ts
│   │   │   │   ├── security.config.ts
│   │   │   │   └── swagger.config.ts
│   │   │   ├── constants
│   │   │   │   ├── cache.constant.ts
│   │   │   │   ├── error-code.constant.ts
│   │   │   │   ├── event-bus.constant.ts
│   │   │   │   ├── index.ts
│   │   │   │   ├── oss.constant.ts
│   │   │   │   ├── response.constant.ts
│   │   │   │   └── system.constant.ts
│   │   │   ├── global
│   │   │   │   ├── env.ts
│   │   │   │   └── index.ts
│   │   │   ├── helper
│   │   │   │   ├── catchError.ts
│   │   │   │   ├── cron.service.ts
│   │   │   │   ├── crud
│   │   │   │   ├── genRedisKey.ts
│   │   │   │   ├── index.ts
│   │   │   │   └── paginate
│   │   │   ├── index.ts
│   │   │   ├── libraries
│   │   │   │   ├── helpers
│   │   │   │   └── nestjs_libraries
│   │   │   ├── migrations
│   │   │   ├── modules
│   │   │   │   ├── agent
│   │   │   │   ├── auth
│   │   │   │   ├── billing
│   │   │   │   ├── health
│   │   │   │   ├── netdisk
│   │   │   │   ├── public-api
│   │   │   │   ├── settings
│   │   │   │   ├── sse
│   │   │   │   ├── system
│   │   │   │   ├── tasks
│   │   │   │   ├── tenant
│   │   │   │   ├── todo
│   │   │   │   └── user
│   │   │   ├── shared
│   │   │   │   ├── crypto
│   │   │   │   ├── database
│   │   │   │   ├── helper
│   │   │   │   ├── index.ts
│   │   │   │   ├── logger
│   │   │   │   ├── mailer
│   │   │   │   ├── redis
│   │   │   │   ├── services
│   │   │   │   └── shared.module.ts
│   │   │   ├── socket
│   │   │   │   ├── base.gateway.ts
│   │   │   │   ├── business-event.constant.ts
│   │   │   │   ├── events
│   │   │   │   ├── index.ts
│   │   │   │   ├── shared
│   │   │   │   └── socket.module.ts
│   │   │   ├── types
│   │   │   │   ├── env.d.ts
│   │   │   │   └── fastify.d.ts
│   │   │   └── utils
│   │   │       ├── captcha.util.ts
│   │   │       ├── crypto.util.ts
│   │   │       ├── date.util.ts
│   │   │       ├── file.util.ts
│   │   │       ├── index.ts
│   │   │       ├── ip.util.ts
│   │   │       ├── is.util.ts
│   │   │       ├── list2tree.util.ts
│   │   │       ├── permission.util.ts
│   │   │       ├── redis.util.ts
│   │   │       ├── schedule.util.ts
│   │   │       └── tool.util.ts
│   │   ├── tsconfig.json
│   │   └── tsconfig.lib.json
│   ├── shared
│   │   ├── README.md
│   │   ├── eslint.config.mjs
│   │   ├── package.json
│   │   ├── project.json
│   │   ├── src
│   │   │   ├── index.ts
│   │   │   ├── shared.module.ts
│   │   │   └── utils
│   │   │       └── app-env.util.ts
│   │   ├── tsconfig.json
│   │   └── tsconfig.lib.json
│   └── supabase
│       ├── package.json
│       ├── project.json
│       ├── src
│       │   ├── index.ts
│       │   ├── supabase-auth.service.spec.ts
│       │   ├── supabase-auth.service.ts
│       │   ├── supabase-keys.util.spec.ts
│       │   ├── supabase-keys.util.ts
│       │   ├── supabase.config.ts
│       │   ├── supabase.module.ts
│       │   └── supabase.service.ts
│       ├── tsconfig.json
│       ├── tsconfig.lib.json
│       └── workflow.md
├── logs
│   ├── app-error.2026-06-14.log
│   ├── app-error.2026-06-15.log
│   ├── app-error.2026-06-16.log
│   ├── app-error.2026-06-21.log
│   ├── app.2026-06-14.log
│   ├── app.2026-06-15.log
│   ├── app.2026-06-16.log
│   └── app.2026-06-21.log
├── nx.json
├── package.json
├── plan-crm.md
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
│   │   ├── migrate-lp-crm-to-crm.js
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
│   │   │   └── pg-client.js
│   │   ├── pgloader.load.template
│   │   ├── run-phase7.js
│   │   └── validate-cutover.js
│   └── test-stripe-webhook.sh
├── structure.md
├── tmp
│   ├── apps
│   │   └── librefang-backend
│   │       └── libs
│   │           └── librefang-client
│   └── libs
│       ├── crm-core
│       │   └── build
│       ├── database
│       │   └── build
│       ├── dto
│       │   └── build
│       ├── librefang-client
│       │   └── build
│       ├── nest-core
│       │   └── build
│       ├── shared
│       │   └── build
│       └── supabase
│           └── build
├── tsconfig.base.json
├── tsconfig.json
├── tsconfig.spec.json
├── turbo.json
└── workflow.md