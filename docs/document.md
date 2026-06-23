Hướng dẫn sử dụng CRM & đấu nối ladipage-fe

1. Kiến trúc tổng quan

ladipage-fe (:3000)
    │  Bearer JWT (nestToken)
    │  NEXT_PUBLIC_API_URL → http://localhost:7002/api
    ▼
ladipage-backend (:7002)
    ├── CrmModule (REST /api/crm/*)
    ├── CrmFacade → lp_* hoặc crm_* (theo CRM_ENABLED)
    └── libs/crm-core (person, pipeline, opportunity, …)

FE không gọi trực tiếp DB — mọi thứ qua REST /api/crm/*, format { code, message, data }.

───

2. Chuẩn bị backend (bắt buộc trước khi FE dùng CRM đầy đủ)

2.1. Env backend (liora-monorepo/.env)

# Bật CRM chính thức (crm_person, crm_company, …)
CRM_ENABLED=true

LADIPAGE_PORT=7002
DATABASE_URL=postgresql://...
# Supabase auth nếu FE dùng NEXT_PUBLIC_AUTH_MODE=supabase
USE_SUPABASE_AUTH=true

2.2. Migration & cutover (một lần / môi trường)

cd liora-monorepo
pnpm db:migration:run                    # tạo bảng crm_*
pnpm db:migrate-crm -- --dry-run         # xem trước
pnpm db:migrate-crm                      # migrate lp_* → crm_*
pnpm dev:ladipage                        # hoặc docker restart liora-ladipage-dev

2.3. Kiểm tra nhanh

node scripts/db/ladipage-tenant-smoke-test.js   # 39/39 pass khi CRM_ENABLED=true
# Swagger: http://localhost:7002/docs

───

3. Auth — FE gọi CRM như thế nào

Mọi route CRM cần JWT + tenant context (tenantId trong token).

┌──────┬─────────────────────────────────────────────────────────┐
│ Bước │ Mô tả                                                   │
├──────┼─────────────────────────────────────────────────────────┤
│ 1    │ User đăng nhập Supabase hoặc legacy                     │
├──────┼─────────────────────────────────────────────────────────┤
│ 2    │ FE gọi POST /api/auth/exchange → nhận nestToken         │
├──────┼─────────────────────────────────────────────────────────┤
│ 3    │ Axios interceptor gắn Authorization: Bearer <nestToken> │
└──────┴─────────────────────────────────────────────────────────┘

Đã có sẵn trong ladipage-fe/src/lib/api/api-client.ts — mọi crmApi.* tự gắn token.

Env FE (ladipage-fe/.env):

NEXT_PUBLIC_API_URL=http://localhost:7002/api
NEXT_PUBLIC_AUTH_MODE=supabase          # hoặc legacy
NEXT_PUBLIC_API_MOCKING=false           # tắt MSW khi test BE thật
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...

───

4. API CRM — bảng endpoint đầy đủ

4.1. Luôn hoạt động (không cần CRM_ENABLED)

┌──────────────────┬────────────────────┬────────────────────────────────────────┐
│ Method           │ Route              │ Mô tả                                  │
├──────────────────┼────────────────────┼────────────────────────────────────────┤
│ GET              │ /crm/customers     │ Danh sách khách (lp_* hoặc crm_person) │
├──────────────────┼────────────────────┼────────────────────────────────────────┤
│ POST             │ /crm/customers     │ Tạo khách                              │
├──────────────────┼────────────────────┼────────────────────────────────────────┤
│ GET/PATCH/DELETE │ /crm/customers/:id │ Chi tiết / sửa / xóa                   │
├──────────────────┼────────────────────┼────────────────────────────────────────┤
│ GET/POST         │ /crm/companies     │ Công ty                                │
├──────────────────┼────────────────────┼────────────────────────────────────────┤
│ GET/POST         │ /crm/segments      │ Phân khúc                              │
├──────────────────┼────────────────────┼────────────────────────────────────────┤
│ GET/POST         │ /crm/tags          │ Tags                                   │
├──────────────────┼────────────────────┼────────────────────────────────────────┤
│ GET/POST         │ /crm/custom-fields │ Custom fields (Pro quota khi CRM on)   │
├──────────────────┼────────────────────┼────────────────────────────────────────┤
│ GET              │ /crm/error-logs    │ Log lỗi sync                           │
└──────────────────┴────────────────────┴────────────────────────────────────────┘

4.2. Cần CRM_ENABLED=true (+ CrmEnabledGuard)

┌───────────────────────┬──────────────────────────────┬─────────────────────────────┐
│ Method                │ Route                        │ Mô tả                       │
├───────────────────────┼──────────────────────────────┼─────────────────────────────┤
│ GET                   │ /crm/pipelines/default       │ Pipeline + stages (Kanban)  │
├───────────────────────┼──────────────────────────────┼─────────────────────────────┤
│ GET/POST/PATCH/DELETE │ /crm/opportunities           │ Deal                        │
├───────────────────────┼──────────────────────────────┼─────────────────────────────┤
│ PATCH                 │ /crm/opportunities/:id/stage │ Kéo thả stage               │
├───────────────────────┼──────────────────────────────┼─────────────────────────────┤
│ GET/POST/PATCH/DELETE │ /crm/tasks                   │ Task                        │
├───────────────────────┼──────────────────────────────┼─────────────────────────────┤
│ GET/POST/PATCH/DELETE │ /crm/notes                   │ Ghi chú                     │
├───────────────────────┼──────────────────────────────┼─────────────────────────────┤
│ GET                   │ /crm/activities              │ Timeline (?personId=)       │
├───────────────────────┼──────────────────────────────┼─────────────────────────────┤
│ GET/POST              │ /crm/objects                 │ Custom objects (Enterprise) │
├───────────────────────┼──────────────────────────────┼─────────────────────────────┤
│ GET/POST              │ /crm/objects/:slug/records   │ Records JSONB               │
└───────────────────────┴──────────────────────────────┴─────────────────────────────┘

4.3. Tích hợp chéo (tự động khi CRM on)

┌────────────────────────────────────────┬───────────────────────────────────────────────────┐
│ Module                                 │ Hành vi                                           │
├────────────────────────────────────────┼───────────────────────────────────────────────────┤
│ Ecom POST /ecom/orders                 │ findOrCreateByContact → crm_person, ghi person_id │
├────────────────────────────────────────┼───────────────────────────────────────────────────┤
│ Dashboard /dashboard/summary           │ Đếm từ crm_person                                 │
├────────────────────────────────────────┼───────────────────────────────────────────────────┤
│ Analytics /analytics/reports/customers │ Báo cáo từ CRM                                    │
└────────────────────────────────────────┴───────────────────────────────────────────────────┘

4.4. Ví dụ request

Tạo khách hàng:

POST /api/crm/customers
Authorization: Bearer <jwt>
Content-Type: application/json

{
  "name": "Nguyễn Văn A",
  "phone": "0901234567",
  "email": "a@company.com",
  "status": "ACTIVE"
}

Response (code: 200):

{
  "code": 200,
  "message": "success",
  "data": {
    "id": "a567d761-42ca-45f1-bf7a-51a3e8bd7ba8",
    "name": "Nguyễn Văn A",
    "phone": "0901234567",
    "email": "a@company.com",
    "status": "ACTIVE",
    "tags": [],
    "createdAt": "2026-06-20T13:40:25.049Z"
  }
}

Tạo deal (cần CRM_ENABLED=true):

POST /api/crm/opportunities
{
  "name": "Gói Pro",
  "amount": 5000000,
  "stageSlug": "new",
  "personId": "a567d761-42ca-45f1-bf7a-51a3e8bd7ba8"
}

───

5. Trạng thái FE hiện tại (ladipage-fe)

Đã đấu nối

┌───────────────────┬────────────────────────────────────────┬──────────────────────────────────────────────────────┐
│ Thành phần        │ File                                   │ Ghi chú                                              │
├───────────────────┼────────────────────────────────────────┼──────────────────────────────────────────────────────┤
│ Trang khách hàng  │ src/app/(admin)/khach-hang/page.tsx    │ Tab customers có API                                 │
├───────────────────┼────────────────────────────────────────┼──────────────────────────────────────────────────────┤
│ API client        │ src/lib/api/endpoints/crm.api.ts       │ list/create customers, segments                      │
├───────────────────┼────────────────────────────────────────┼──────────────────────────────────────────────────────┤
│ React Query hooks │ src/features/crm/hooks/useCustomers.ts │ useCustomers, useCreateCustomer                      │
├───────────────────┼────────────────────────────────────────┼──────────────────────────────────────────────────────┤
│ Mapper            │ src/lib/mappers/crm.mapper.ts          │ API → UI format                                      │
├───────────────────┼────────────────────────────────────────┼──────────────────────────────────────────────────────┤
│ Types             │ packages/@liora/api-types/src/crm.ts   │ chưa sync types mới (opportunity, activity…)         │
├───────────────────┼────────────────────────────────────────┼──────────────────────────────────────────────────────┤
│ MSW mock          │ src/mocks/handlers.ts                  │ Mock /crm/customers khi NEXT_PUBLIC_API_MOCKING=true │
└───────────────────┴────────────────────────────────────────┴──────────────────────────────────────────────────────┘

Chưa đấu nối (UI local state / mock)

┌─────────────────┬──────────────────────────┬───────────────────────────┐
│ Tab UI          │ Component                │ Trạng thái                │
├─────────────────┼──────────────────────────┼───────────────────────────┤
│ Công ty         │ CompanyList.tsx          │ State local, chưa gọi API │
├─────────────────┼──────────────────────────┼───────────────────────────┤
│ Tags            │ CustomerTags.tsx         │ Chưa wire                 │
├─────────────────┼──────────────────────────┼───────────────────────────┤
│ Custom fields   │ CustomerCustomFields.tsx │ Chưa wire                 │
├─────────────────┼──────────────────────────┼───────────────────────────┤
│ Error logs      │ ErrorLog.tsx             │ Chưa wire                 │
├─────────────────┼──────────────────────────┼───────────────────────────┤
│ Pipeline / Deal │ —                        │ Chưa có page              │
├─────────────────┼──────────────────────────┼───────────────────────────┤
│ Timeline        │ —                        │ Chưa có page              │
└─────────────────┴──────────────────────────┴───────────────────────────┘

Lỗi cần sửa khi nâng cấp FE

1. updateCustomer dùng apiPut — backend dùng PATCH (customer.controller.ts).
2. id: number trong crm.api.ts — khi CRM_ENABLED=true, id là UUID string.
3. api-types FE thiếu OpportunityItem, PipelineItem, … (backend đã có trong apps/ladipage-backend/libs/api-types/src/crm.ts).

───

6. Đấu nối FE — từng bước

Bước 1: Sync types

Copy hoặc symlink types từ backend sang FE:

liora-monorepo/apps/ladipage-backend/libs/api-types/src/crm.ts
    → ladipage-fe/packages/@liora/api-types/src/crm.ts

Thêm export trong packages/@liora/api-types/src/index.ts nếu chưa có.

Bước 2: Mở rộng crm.api.ts

// ladipage-fe/src/lib/api/endpoints/crm.api.ts
import { apiGet, apiPost, apiPatch, apiDelete } from "../api-client";
import type {
  CustomerItem, CompanyItem, PaginatedData,
  PipelineItem, OpportunityItem, TaskItem, NoteItem, ActivityItem,
} from "@liora/api-types";

export const crmApi = {
  // --- đã có ---
  listCustomers(params?) { return apiGet<PaginatedData<CustomerItem>>("/crm/customers", { params }); },
  createCustomer(payload) { return apiPost<CustomerItem>("/crm/customers", payload); },

  // --- sửa: PATCH + id string ---
  updateCustomer(id: string, payload: Partial<CreateCustomerPayload>) {
    return apiPatch<CustomerItem>(`/crm/customers/${id}`, payload);
  },
  deleteCustomer(id: string) {
    return apiDelete<void>(`/crm/customers/${id}`);
  },

  // --- companies ---
  listCompanies(params?) { return apiGet<PaginatedData<CompanyItem>>("/crm/companies", { params }); },
  createCompany(payload: { name: string }) { return apiPost<CompanyItem>("/crm/companies", payload); },

  // --- sales (CRM_ENABLED=true) ---
  getDefaultPipeline() { return apiGet<PipelineItem>("/crm/pipelines/default"); },
  listOpportunities(params?) { return apiGet<PaginatedData<OpportunityItem>>("/crm/opportunities", { params }); },
  createOpportunity(payload) { return apiPost<OpportunityItem>("/crm/opportunities", payload); },
  moveOpportunityStage(id: string, stageId: string) {
    return apiPatch<OpportunityItem>(`/crm/opportunities/${id}/stage`, { stageId });
  },
  listActivities(params: { personId?: string; page?: number }) {
    return apiGet<PaginatedData<ActivityItem>>("/crm/activities", { params });
  },
};

Bước 3: Query keys & hooks

// src/lib/api/query-keys.ts
crm: {
  customers: (params?) => ["crm", "customers", params] as const,
  companies: (params?) => ["crm", "companies", params] as const,
  pipeline: ["crm", "pipeline"] as const,
  opportunities: (params?) => ["crm", "opportunities", params] as const,
  activities: (personId: string) => ["crm", "activities", personId] as const,
},

Tạo hooks theo pattern useCustomers.ts:

src/features/crm/hooks/
├── useCustomers.ts      ✅ có
├── useCompanies.ts      ← mới
├── usePipeline.ts       ← mới
├── useOpportunities.ts  ← mới
└── useActivities.ts     ← mới

Mẫu hook:

export function useOpportunities(params?: OpportunityListParams) {
  const enabled = useAuthQueryEnabled();
  return useQuery({
    queryKey: queryKeys.crm.opportunities(params),
    queryFn: () => crmApi.listOpportunities(params),
    enabled,
  });
}

Bước 4: Wire UI tabs còn lại

Companies — thay local state trong CompanyList.tsx:

const { data, isLoading } = useCompanies();
const createCompany = useCreateCompany();
// onSubmit → createCompany.mutateAsync({ name })

Customers — bổ sung delete/update:

// khach-hang/page.tsx
const handleDeleteCustomers = async (ids: string[]) => {
  await Promise.all(ids.map((id) => crmApi.deleteCustomer(id)));
  queryClient.invalidateQueries({ queryKey: ["crm", "customers"] });
};

ID luôn là string trong UI:

id: String(customer.id)   // đã có trong crm.mapper.ts ✅

Bước 5: Trang Sales CRM mới (gợi ý route)

src/app/(admin)/ban-hang/page.tsx     # hoặc /crm/deals
├── PipelineBoard (Kanban từ getDefaultPipeline + listOpportunities)
├── OpportunityDetail (tasks, notes, activities)
└── hooks: usePipeline, useOpportunities, useActivities

Luồng Kanban:

                                             ┌─────────────────────────┐                          ┌──────────────────────────┐
┌────────────────────────┐    ┌─────────┐    │           GET           │    ┌────────────────┐    │       Drag → PATCH       │
│ GET /pipelines/default ├───▶│ stages[ ├───▶│ /opportunities?stageId= ├───▶│ Render columns ├───▶│ /opportunities/:id/stage │
└────────────────────────┘    └─────────┘    └─────────────────────────┘    └────────────────┘    └──────────────────────────┘

Bước 6: Ecom ↔ CRM (đã tự động)

Khi tạo order từ FE (ecom.api.ts), backend tự link person — không cần FE gọi CRM thêm:

// POST /ecom/orders — customerPhone/email → crm_person.person_id

Dashboard home (page.tsx) đã dùng useCustomersReport — số liệu tự đổi khi CRM_ENABLED=true.

Bước 7: Tắt mock, test thật

# ladipage-fe/.env
NEXT_PUBLIC_API_MOCKING=false
NEXT_PUBLIC_API_URL=http://localhost:7002/api

# Terminal 1
cd liora-monorepo && pnpm dev:ladipage

# Terminal 2
cd ladipage-fe && npm run dev

Mở /khach-hang → tạo khách → kiểm tra Network tab POST /api/crm/customers → id UUID.

───

7. Ma trận tier & guard (FE cần xử lý lỗi)

┌─────────────────────────┬─────────────────────┬─────────────────────────┐
│ Tính năng               │ Tier                │ HTTP khi không đủ quyền │
├─────────────────────────┼─────────────────────┼─────────────────────────┤
│ Customers, companies    │ Free+               │ —                       │
├─────────────────────────┼─────────────────────┼─────────────────────────┤
│ Custom fields POST      │ Pro+                │ 403 Forbidden           │
├─────────────────────────┼─────────────────────┼─────────────────────────┤
│ Opportunities, pipeline │ CRM_ENABLED=true    │ 503 nếu flag off        │
├─────────────────────────┼─────────────────────┼─────────────────────────┤
│ Custom objects          │ Enterprise/Lifetime │ 403 Forbidden           │
└─────────────────────────┴─────────────────────┴─────────────────────────┘

FE nên bắt ApiBusinessError và hiển thị upsell:

catch (e) {
  if (e instanceof ApiBusinessError && e.code === 403) {
    // show upgrade modal
  }
}

───

8. Checklist đấu nối FE hoàn chỉnh

┌───┬───────────────────────────────────────────────────────┬────────────┐
│ # │ Task                                                  │ Ưu tiên    │
├───┼───────────────────────────────────────────────────────┼────────────┤
│ 1 │ Sync @liora/api-types CRM types                       │ Cao        │
├───┼───────────────────────────────────────────────────────┼────────────┤
│ 2 │ Sửa crm.api.ts: PATCH, id: string                     │ Cao        │
├───┼───────────────────────────────────────────────────────┼────────────┤
│ 3 │ Wire CompanyList → /crm/companies                     │ Cao        │
├───┼───────────────────────────────────────────────────────┼────────────┤
│ 4 │ Wire delete/update customers                          │ Trung bình │
├───┼───────────────────────────────────────────────────────┼────────────┤
│ 5 │ Thêm page Pipeline/Kanban                             │ Trung bình │
├───┼───────────────────────────────────────────────────────┼────────────┤
│ 6 │ Timeline useActivities(personId) trên customer detail │ Trung bình │
├───┼───────────────────────────────────────────────────────┼────────────┤
│ 7 │ Custom fields + billing gate                          │ Thấp (Pro) │
├───┼───────────────────────────────────────────────────────┼────────────┤
│ 8 │ Enterprise objects admin                              │ Thấp       │
└───┴───────────────────────────────────────────────────────┴────────────┘

───

9. Tóm tắt nhanh cho dev

# Backend
CRM_ENABLED=true
pnpm db:migration:run && pnpm db:migrate-crm
pnpm dev:ladipage

# Frontend
NEXT_PUBLIC_API_URL=http://localhost:7002/api
NEXT_PUBLIC_API_MOCKING=false
npm run dev
# → /khach-hang (customers đã live)
# → bổ sung crm.api + hooks cho companies, deals, timeline