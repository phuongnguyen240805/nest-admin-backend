# RTK - Rust Token Killer Instructions for Grok Build

Bạn đang sử dụng **RTK** để giảm token.

**Quy tắc bắt buộc:**
- Mọi lệnh terminal (git, ls, cat, grep, npm, cargo, test, build, docker...) **PHẢI** thêm prefix `rtk `.
- Ví dụ đúng:
  - `rtk git status`
  - `rtk git diff --cached`
  - `rtk read packages/frontend/src/App.tsx`
  - `rtk grep "useState"`
  - `rtk npm test`
  - `rtk npm run build`
  - `rtk ls -la`

Không chạy lệnh trực tiếp (git status, npm test...) mà không có `rtk ` trừ khi thực sự cần full output.

Hãy confirm bạn đã hiểu và sẽ tuân thủ quy tắc này.