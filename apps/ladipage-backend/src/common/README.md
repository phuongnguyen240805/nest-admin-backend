# src/common/ - Foundation & Shared (Giai đoạn 1)

Mục tiêu: Xây dựng các thành phần **tái sử dụng** cho toàn bộ ladipage-backend (và các app khác trong monorepo thông qua nest-core).

## Nguyên tắc thiết kế

- **DRY**: Logic cốt lõi nằm ở `libs/nest-core/src/common/`
- Ladipage-backend's `src/common/` chỉ là **re-export layer** + app-specific mở rộng (nếu cần)
- Mọi module sau (funnelx, publish, credit, website...) đều nên dùng các thành phần ở đây

## Cấu trúc hoàn chỉnh đề xuất

```
src/common/
├── index.ts                    # Barrel chính - export tất cả
│
├── entities/
│   ├── base.entity.ts          # BaseEntity (UUID + workspaceId + timestamps + soft delete)
│   └── index.ts
│
├── services/
│   ├── base.service.ts         # BaseService (CRUD + pagination + workspace scoping + withTransaction)
│   └── index.ts
│
├── dto/
│   ├── pagination.dto.ts
│   ├── filter.dto.ts
│   ├── response.dto.ts         # ResponseDto + ErrorResponseDto
│   ├── id-param.dto.ts
│   └── index.ts
│
├── decorators/
│   ├── current-user.decorator.ts   # @CurrentUser()
│   ├── workspace.decorator.ts      # @Workspace()  ← RẤT QUAN TRỌNG cho multi-tenant
│   ├── ... (các decorator khác từ nest-core)
│   └── index.ts
│
├── filters/
│   ├── all-exceptions.filter.ts    # AllExceptionsFilter (global)
│   └── index.ts
│
├── interceptors/
│   ├── ... (Transform, Idempotence, Tenant, Logging, Timeout...)
│   └── index.ts
│
├── pipes/
│   ├── ... (CreatorPipe, UpdaterPipe, ParseIntPipe...)
│   └── index.ts
│
├── utils/                      # Tiện ích dùng chung
│   └── index.ts
│
└── README.md
```

## Thành phần cốt lõi đã triển khai (Giai đoạn 1)

| Thành phần            | Vị trí (shared)                          | Sử dụng |
|-----------------------|------------------------------------------|-------|
| `BaseEntity`          | `libs/nest-core/src/common/entities`     | Tất cả entity mới nên extend |
| `BaseService`         | `libs/nest-core/src/common/services`     | Extend cho service của từng module |
| `PaginationDto`       | `.../dto`                                | Dùng trong query list |
| `FilterDto`           | `.../dto`                                | Extend cho filter đặc thù |
| `ResponseDto`         | `.../dto`                                | Chuẩn response + error |
| `@CurrentUser()`      | `.../decorators`                         | Lấy user sau khi auth |
| `@Workspace()`        | `.../decorators`                         | Lấy workspaceId (multi-tenant) |
| `AllExceptionsFilter` | `.../filters`                            | Đăng ký global trong main/app.module |
| Logger (winston)      | `libs/nest-core/shared/logger`           | Đã có, tích hợp qua SharedModule |

## Cách dùng trong module mới (ví dụ PublishModule)

```ts
import { BaseEntity, BaseService, Workspace, CurrentUser, PaginationDto } from '../common';

@Entity()
export class PublishJob extends BaseEntity { ... }

@Injectable()
export class PublishService extends BaseService<PublishJob> {
  constructor(
    @InjectRepository(PublishJob) repo: Repository<PublishJob>,
    dataSource: DataSource,
  ) {
    super(repo, dataSource);
  }

  async publish(user: any, @Workspace() wsId: string) { ... }
}
```

## Global setup (đã cấu hình trong main.ts + app.module.ts)

- `ValidationPipe` với đúng yêu cầu: `whitelist`, `transform`, `forbidNonWhitelisted`, `validationError: { target: false }`
- `AllExceptionsFilter` global
- Interceptors (Transform, Tenant, Idempotence, ...)
- Guards (Jwt + Rbac)

Tất cả đã sẵn sàng cho các giai đoạn sau.
