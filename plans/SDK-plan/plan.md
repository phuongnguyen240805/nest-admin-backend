Mục tiêu: Ladipage trở thành orchestration shell — giữ auth, workspace, billing, app store, domain/public delivery branding — trong khi:

┌──────────────────────────────────────────────┬────────────────────────────────────┬───────────────────────────────────────────────────┐
│ Capability                                   │ Engine                             │ Thay thế                                          │
├──────────────────────────────────────────────┼────────────────────────────────────┼───────────────────────────────────────────────────┤
│ Landing editor + page tree + publish CMS     │ Instatic                           │ Toàn bộ VisualEditor / Puck / editor_data hiện    │
│                                              │                                    │ tại                                               │
├──────────────────────────────────────────────┼────────────────────────────────────┼───────────────────────────────────────────────────┤
│ Office agents / task / schedule / CLI        │ LibreFang                          │ claw-api + mock office domain “tự chế” phía BE    │
│ runtime                                      │                                    │                                                   │
├──────────────────────────────────────────────┼────────────────────────────────────┼───────────────────────────────────────────────────┤
│ Kết nối                                      │ SDK + contract layer thuộc         │ Không gọi raw HTTP rải rác trong FE               │
│                                              │ Ladipage                           │                                                   │
└──────────────────────────────────────────────┴────────────────────────────────────┴───────────────────────────────────────────────────┘
Nguyên tắc vàng: hai upstream được phép breaking change; Ladipage chỉ phụ thuộc contract do chính mình sở hữu.
