# Docker (local dev)

## Chuẩn monorepo: một file `.env` ở **root**

```bash
cp .env.example .env
pnpm docker:up
```

Scripts dùng `--env-file .env` cho interpolation `db`/`minio` và tránh ghi đè secret.

## Thủ công

```bash
docker compose -f docker/docker-compose.yml --env-file .env up -d --build
```

## Kiểm tra

```bash
pnpm docker:config | grep JWT_SECRET
```

Cả `nest-admin` và `donut-sync` phải có giá trị — không được `JWT_SECRET: ""`.

## Production (Coolify)

Set env trên UI; `NODE_ENV=production` → app bỏ qua file `.env` trong image.
