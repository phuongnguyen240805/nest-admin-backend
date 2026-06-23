You are a Senior Backend Developer specializing in NestJS, with experience building multi-tenant SaaS systems. Your task is to build a **Backend** for the LadiPage project to fully support the following functionalities:
### Functionalities to support
1. **Dashboard**
2. **E-commerce / Sales**
3. **CRM** (Customer Relationship Management)
4. **Analytics & Reports**
5. **Settings**
6. **Billing & Subscription**
**Important Note**:
- Focus only on building the **Backend**.

- The frontend will only call APIs on **existing** pages/components. Absolutely no requests to create new pages or change the current UI/layout.

- Adhere to the response format: `{code, message, data}`
- Support multi-tenant (all data must be filtered by tenant). ### General Technical Requirements
- Use TypeORM + Entity + Repository pattern.

- Create clear DTO validation.

- Create migrations for new tables.

- It is recommended to create a shared directory `libs/ladipage-types` to share types between the backend and frontend.

- All APIs related to business logic must retrieve `tenantId` from the context (after fixing Phase 0).

### Details of Modules to be Built
#### 1. Billing & Upgrading (Payment)
- Module: `libs/nest-core/src/modules/billing/`
- Required APIs:

- `GET /api/plans` — List of plans (Free / Pro / Enterprise)

- `GET /api/billing/usage` — Usage statistics (number of pages, domains, credits, etc.)

- `POST /api/billing/subscribe` — Register a plan (using Stripe Embedded Checkout)

- `POST /api/billing/cancel` — Cancel a subscription

- `GET /api/billing/portal` — Link to manage payment cards (Stripe Customer Portal)

- `GET /api/billing/check/:sessionId` — Check payment status
- Support Stripe Webhook for updating subscription tier.

#### 2. Settings
- Create a settings module.

- APIs:

- `GET /api/settings/workspace` — Get workspace information (name, logo, timezone…)

- `PUT /api/settings/workspace` — Update workspace information

- `GET /api/settings/integrations` — Get integration token (Facebook, Zalo…)

- `PUT /api/settings/integrations` — Save integration token (encrypted)
#### 3. Sales (Ecom Store)
- Create a new module: `apps/ladipage-backend/src/modules/ecom-store/`
- Main table to create:

lp_product (id, tenantId, name, sku, price, stock, status, ...)
lp_product_category (id, tenantId, name, parentId, ...)
lp_product_tag (id, tenantId, name)
lp_product_tag_map (productId, tagId)
lp_order (id, tenantId, code, customerId, status, total, paymentMethod, ...)
lp_order_item (id, orderId, productId, quantity, unitPrice, ...)
lp_order_tag (id, tenantId, name)
lp_delivery_note (id, orderId, ...)
lp_product_review (id, productId, rating, content, ...)
lp_custom_field (id, tenantId, entityType, fieldName, dataType, ...)
- Main APIs: 
- Orders: CRUD + status update + list of unfinished orders 
- Products: CRUD 
- Categories, Tags: CRUD 
- Inventory: Update inventory 
- Reviews, Custom Fields, Delivery Notes: CRUD
#### 4. Customers (CRM)
- Create module: `apps/ladipage-backend/src/modules/crm/`
- Main board:
lp_customer (id, tenantId, name, phone, email, status, ...)
lp_company (id, tenantId, name, ...)
lp_customer_company (customerId, companyId)
lp_segment (id, tenantId, name, isDefault, rules JSON)
lp_customer_segment (customerId, segmentId)
lp_customer_tag (id, tenantId, name)
lp_customer_tag_map (customerId, tagId)
lp_customer_custom_field (id, tenantId, fieldName, dataType, ...)
lp_customer_field_value (customerId, fieldId, value)
lp_sync_error_log(id, tenantId, customerId, errorCode, ...)
- API: 
- CRUD Customer 
- CRUD Segment 
- CRUD Tag 
- Automatically create or link customers when creating orders (by phone/email)
#### 5. Reporting (Analytics)
- Create modules: `apps/ladipage-backend/src/modules/analytics/`
- Reports to support:

- Sales reports (revenue, number of orders, AOV over time)

- Business reports (conversion funnel, best-selling products)

- Customer reports (new customers, returning customers, segments)

- Automation reports (if any)
- Response format should be suitable for charting with ApexCharts (labels, series, summary).

#### 6. Dashboard
- Create a summary API:

- `GET /api/dashboard/summary`

- Returns: today's number of orders, pending orders, revenue, total customers, new customers, subscription information, recent orders, short-term revenue chart.

- `GET /api/dashboard/onboarding` — Onboarding status (if any)
### Recommended Execution Order
1. **Phase 0 (Required)**: Modify Tenant/Organization context + Stripe webhook + scaffold modules.
2. **Billing & Settings** (can be done in parallel).
3. **Ecom Store (Sales)** — The largest module.
4. **CRM (Customers)**.
5. **Analytics (Reporting)**.
6. **Dashboard (Overview)**.
### Requirements Upon Completion
After deployment, provide a **results report** with the following structure:
1. **Summary** of completed modules.
2. **List of implemented APIs** (by function).
3. **Newly created database tables** (with migrations).
4. **Important files/modules** created or modified.

5. **Remaining issues** or risks.

6. **Quick test instructions** for each functional module.

7. **Suggested next steps**.

**Start with Phase 0 first.** After completing Phase 0, report the results of Phase 0 before proceeding.

Work carefully, adhere to multi-tenant principles, and maintain a consistent response format.