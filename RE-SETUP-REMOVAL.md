# RE (Reverse Engineering) Setup & Removal Guide

**Mục tiêu:** Setup reverse-skill + MCP + thực hiện capture cho appv6.ladipage.com theo plan.  
**Nguyên tắc:** TẤT CẢ logic RE phải dễ dàng loại bỏ khi dự án hoàn thành (không để lại debt trong source chính).

## 1. Vị trí cài đặt (Removable by design)

- **reverse-skill**: Luôn clone **ngoài monorepo** (ví dụ `D:\Tools\reverse-skill-ladipage-re`).
- **MCP / hooks**: Chỉ config cục bộ trên máy developer (không commit).
- **Tăng cường trong monorepo**: Chỉ thêm vào `tools/cdp-reverse-engineer/re-temp/` (thư mục dễ xóa) hoặc comment rõ "TEMP RE ONLY".
- **Dữ liệu capture**: Giữ trong `tools/cdp-reverse-engineer/output/` (có thể xóa sau khi export types/contract xong).

**Cách xóa sạch sau dự án**:
```powershell
# 1. Xóa reverse-skill
Remove-Item -Recurse -Force D:\Tools\reverse-skill-ladipage-re

# 2. (Nếu có) xóa temp trong monorepo
Remove-Item -Recurse -Force tools/cdp-reverse-engineer/re-temp

# 3. Xóa output capture lớn (giữ types/contract)
Remove-Item -Recurse -Force tools/cdp-reverse-engineer/output

# 4. Xóa file hướng dẫn này + bất kỳ file RE-*.md nào nếu không cần
```

## 2. Setup reverse-skill (dùng rtk)

Mở PowerShell **trong môi trường có rtk**:

```powershell
# Tạo thư mục ngoài
rtk mkdir -p D:\Tools

# Clone (depth 1 để nhanh, removable)
rtk git clone https://github.com/zhaoxuya520/reverse-skill.git D:\Tools\reverse-skill-ladipage-re --depth 1

cd D:\Tools\reverse-skill-ladipage-re

# Bắt buộc bootstrap (tạo tool-index)
rtk powershell -ExecutionPolicy Bypass -File skills/scripts/refresh-tool-index.ps1

# Đọc và để AI tự config (theo README của reverse-skill)
# Sau đó đọc RULES.md để inject routing
```

## 3. MCP Setup (jshookmcp + anything-analyzer)

Thêm vào MCP config của client (Claude Code / Codex / Cursor...):

```json
{
  "mcpServers": {
    "jshook": {
      "command": "npx",
      "args": ["-y", "@jshookmcp/jshook@latest"],
      "env": {
        "JSHOOK_BASE_PROFILE": "search"
      }
    },
    "anything-analyzer": {
      "url": "http://localhost:23816/mcp"
    }
  }
}
```

Bootstrap thêm:
```powershell
rtk powershell -File D:\Tools\reverse-skill-ladipage-re\skills\scripts\bootstrap-reverse.ps1 -Capability @('jshookmcp','anything-analyzer') -StartServices
```

## 4. Chạy capture (theo plan) - chỉ reverse

Tất cả lệnh phải có `rtk ` prefix.

```powershell
cd tools/cdp-reverse-engineer

# Chuẩn bị
rtk npm install
rtk npm run install:browsers

# Session (chạy 1 lần)
rtk npm run capture:ladipage:login
rtk npm run capture:ladipage:session

# Các phase thiếu (chỉ reverse, có thể --headed khi cần)
rtk npm run capture:phaseA:read
rtk npm run capture:phaseA:mutations -- --headed

rtk npm run capture:phaseB:read
rtk npm run capture:phaseB:board
rtk npm run capture:phaseB:detail
rtk npm run capture:phaseB:mutations -- --headed

rtk npm run capture:phaseC:read
rtk npm run capture:phaseC:editor -- --headed
rtk npm run capture:phaseC:mutations -- --headed

# Reports / landing
rtk npm run capture:phase4:read
rtk npm run capture:phase4:page

# Merge + export (luôn chạy sau capture)
rtk npm run merge:schema
rtk npm run export:ts-types
rtk npm run export:contract-fixtures
```

**Lưu ý quan trọng**:
- Chỉ dùng để capture + phân tích.
- KHÔNG edit code trong `apps/ladipage-backend/src/modules` (trừ khi tách ra temp mapper mẫu trong re-temp).
- Sau khi export types + fixtures xong → có thể xóa output lớn.

## 5. Phân tích với reverse-skill (js-reverse + browser-automation)

Sau khi có data:
- Dùng jshookmcp để hook thêm initiator, SourceMap.
- Dùng browser-automation skill để cải thiện action (snapshot → @ref thay selector).
- Grok/Codex đọc output/*.json + heapsnapshot (nếu capture) để map route.

## 6. Dọn dẹp khi hoàn thành

Xem phần đầu file này. Không để lại thư mục reverse-skill hay temp script nào trong repo khi release.

---

**Lệnh này file được tạo để tuân thủ yêu cầu "khi hoàn thành dự án sẽ loại bỏ các logic liên quan đến RE này".**
