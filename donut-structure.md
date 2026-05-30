.
├── ./AGENTS.md
├── ./assets
│   ├── ./assets/donut-preview.png
│   └── ./assets/logo.png
├── ./biome.json
├── ./CHANGELOG.md
├── ./CLAUDE.md -> AGENTS.md
├── ./CODE_OF_CONDUCT.md
├── ./components.json
├── ./CONTRIBUTING.md
├── ./CONTRIBUTOR_LICENSE_AGREEMENT.md
├── ./docs
│   └── ./docs/self-hosting-donut-sync.md
├── ./donut-browser-daemon
├── ./donut-sync
│   ├── ./donut-sync/docker-compose.yml
│   ├── ./donut-sync/Dockerfile
│   ├── ./donut-sync/nest-cli.json
│   ├── ./donut-sync/nixpacks.toml
│   ├── ./donut-sync/package.json
│   ├── ./donut-sync/README.md
│   ├── ./donut-sync/src
│   │   ├── ./donut-sync/src/app.controller.spec.ts
│   │   ├── ./donut-sync/src/app.controller.ts
│   │   ├── ./donut-sync/src/app.module.ts
│   │   ├── ./donut-sync/src/app.service.ts
│   │   ├── ./donut-sync/src/auth
│   │   │   ├── ./donut-sync/src/auth/auth.guard.ts
│   │   │   └── ./donut-sync/src/auth/user-context.interface.ts
│   │   ├── ./donut-sync/src/main.ts
│   │   └── ./donut-sync/src/sync
│   │       ├── ./donut-sync/src/sync/dto
│   │       │   └── ./donut-sync/src/sync/dto/sync.dto.ts
│   │       ├── ./donut-sync/src/sync/internal.controller.ts
│   │       ├── ./donut-sync/src/sync/sync.controller.ts
│   │       ├── ./donut-sync/src/sync/sync.module.ts
│   │       └── ./donut-sync/src/sync/sync.service.ts
│   ├── ./donut-sync/test
│   │   ├── ./donut-sync/test/app.e2e-spec.ts
│   │   ├── ./donut-sync/test/jest-e2e.json
│   │   ├── ./donut-sync/test/sync.e2e-spec.ts
│   │   ├── ./donut-sync/test/test-env.ts
│   │   └── ./donut-sync/test/tsconfig.json
│   ├── ./donut-sync/tsconfig.build.json
│   └── ./donut-sync/tsconfig.json
├── ./flake.lock
├── ./flake.nix
├── ./index.html
├── ./LICENSE
├── ./next.config.ts
├── ./package.json
├── ./pnpm-lock.yaml
├── ./pnpm-workspace.yaml
├── ./postcss.config.mjs
├── ./public
│   ├── ./public/favicon.ico
│   ├── ./public/file.svg
│   ├── ./public/globe.svg
│   ├── ./public/next.svg
│   ├── ./public/tauri-nextjs-template-2_screenshot.png
│   ├── ./public/vercel.svg
│   └── ./public/window.svg
├── ./README.md
├── ./scripts
│   ├── ./scripts/dev.sh
│   ├── ./scripts/publish-repo.sh
│   ├── ./scripts/run-with-env.mjs
│   └── ./scripts/sync-test-harness.mjs
├── ./SECURITY.md
├── ./src
│   ├── ./src/app
│   │   ├── ./src/app/layout.tsx
│   │   └── ./src/app/page.tsx
│   ├── ./src/components
│   │   ├── ./src/components/app-update-toast.tsx
│   │   ├── ./src/components/bandwidth-mini-chart.tsx
│   │   ├── ./src/components/camoufox-config-dialog.tsx
│   │   ├── ./src/components/client-providers.tsx
│   │   ├── ./src/components/clone-profile-dialog.tsx
│   │   ├── ./src/components/commercial-trial-modal.tsx
│   │   ├── ./src/components/cookie-copy-dialog.tsx
│   │   ├── ./src/components/cookie-management-dialog.tsx
│   │   ├── ./src/components/create-group-dialog.tsx
│   │   ├── ./src/components/create-profile-dialog.tsx
│   │   ├── ./src/components/custom-toast.tsx
│   │   ├── ./src/components/data-table-action-bar.tsx
│   │   ├── ./src/components/delete-confirmation-dialog.tsx
│   │   ├── ./src/components/delete-group-dialog.tsx
│   │   ├── ./src/components/device-code-verify-dialog.tsx
│   │   ├── ./src/components/dns-blocklist-dialog.tsx
│   │   ├── ./src/components/edit-group-dialog.tsx
│   │   ├── ./src/components/extension-group-assignment-dialog.tsx
│   │   ├── ./src/components/extension-management-dialog.tsx
│   │   ├── ./src/components/flag-icon.tsx
│   │   ├── ./src/components/group-assignment-dialog.tsx
│   │   ├── ./src/components/group-badges.tsx
│   │   ├── ./src/components/group-management-dialog.tsx
│   │   ├── ./src/components/home-header.tsx
│   │   ├── ./src/components/i18n-provider.tsx
│   │   ├── ./src/components/icons
│   │   │   ├── ./src/components/icons/logo.tsx
│   │   │   └── ./src/components/icons/zen-browser.tsx
│   │   ├── ./src/components/import-profile-dialog.tsx
│   │   ├── ./src/components/integrations-dialog.tsx
│   │   ├── ./src/components/launch-on-login-dialog.tsx
│   │   ├── ./src/components/loading-button.tsx
│   │   ├── ./src/components/location-proxy-dialog.tsx
│   │   ├── ./src/components/multiple-selector.tsx
│   │   ├── ./src/components/permission-dialog.tsx
│   │   ├── ./src/components/profile-data-table.tsx
│   │   ├── ./src/components/profile-info-dialog.tsx
│   │   ├── ./src/components/profile-password-dialog.tsx
│   │   ├── ./src/components/profile-selector-dialog.tsx
│   │   ├── ./src/components/profile-sync-dialog.tsx
│   │   ├── ./src/components/proxy-assignment-dialog.tsx
│   │   ├── ./src/components/proxy-check-button.tsx
│   │   ├── ./src/components/proxy-export-dialog.tsx
│   │   ├── ./src/components/proxy-form-dialog.tsx
│   │   ├── ./src/components/proxy-import-dialog.tsx
│   │   ├── ./src/components/proxy-management-dialog.tsx
│   │   ├── ./src/components/release-type-selector.tsx
│   │   ├── ./src/components/settings-dialog.tsx
│   │   ├── ./src/components/shared-camoufox-config-form.tsx
│   │   ├── ./src/components/sync-all-dialog.tsx
│   │   ├── ./src/components/sync-config-dialog.tsx
│   │   ├── ./src/components/sync-follower-dialog.tsx
│   │   ├── ./src/components/theme-provider.tsx
│   │   ├── ./src/components/traffic-details-dialog.tsx
│   │   ├── ./src/components/ui
│   │   │   ├── ./src/components/ui/alert.tsx
│   │   │   ├── ./src/components/ui/auto-height.tsx
│   │   │   ├── ./src/components/ui/badge.tsx
│   │   │   ├── ./src/components/ui/button.tsx
│   │   │   ├── ./src/components/ui/card.tsx
│   │   │   ├── ./src/components/ui/chart.tsx
│   │   │   ├── ./src/components/ui/checkbox.tsx
│   │   │   ├── ./src/components/ui/color-picker.tsx
│   │   │   ├── ./src/components/ui/combobox.tsx
│   │   │   ├── ./src/components/ui/command.tsx
│   │   │   ├── ./src/components/ui/copy-to-clipboard.tsx
│   │   │   ├── ./src/components/ui/dialog.tsx
│   │   │   ├── ./src/components/ui/dropdown-menu.tsx
│   │   │   ├── ./src/components/ui/highlight.tsx
│   │   │   ├── ./src/components/ui/input.tsx
│   │   │   ├── ./src/components/ui/label.tsx
│   │   │   ├── ./src/components/ui/popover.tsx
│   │   │   ├── ./src/components/ui/pro-badge.tsx
│   │   │   ├── ./src/components/ui/progress.tsx
│   │   │   ├── ./src/components/ui/radio-group.tsx
│   │   │   ├── ./src/components/ui/ripple.tsx
│   │   │   ├── ./src/components/ui/scroll-area.tsx
│   │   │   ├── ./src/components/ui/select.tsx
│   │   │   ├── ./src/components/ui/sonner.tsx
│   │   │   ├── ./src/components/ui/table.tsx
│   │   │   ├── ./src/components/ui/tabs.tsx
│   │   │   ├── ./src/components/ui/textarea.tsx
│   │   │   └── ./src/components/ui/tooltip.tsx
│   │   ├── ./src/components/vpn-check-button.tsx
│   │   ├── ./src/components/vpn-form-dialog.tsx
│   │   ├── ./src/components/vpn-import-dialog.tsx
│   │   ├── ./src/components/wayfern-config-form.tsx
│   │   ├── ./src/components/wayfern-terms-dialog.tsx
│   │   ├── ./src/components/window-drag-area.tsx
│   │   └── ./src/components/window-resize-warning-dialog.tsx
│   ├── ./src/hooks
│   │   ├── ./src/hooks/use-app-update-notifications.tsx
│   │   ├── ./src/hooks/use-auto-height.tsx
│   │   ├── ./src/hooks/use-browser-download.ts
│   │   ├── ./src/hooks/use-browser-state.ts
│   │   ├── ./src/hooks/use-browser-support.ts
│   │   ├── ./src/hooks/use-cloud-auth.ts
│   │   ├── ./src/hooks/use-commercial-trial.ts
│   │   ├── ./src/hooks/use-controlled-state.tsx
│   │   ├── ./src/hooks/use-extension-events.ts
│   │   ├── ./src/hooks/use-group-events.ts
│   │   ├── ./src/hooks/use-language.ts
│   │   ├── ./src/hooks/use-permissions.ts
│   │   ├── ./src/hooks/use-profile-events.ts
│   │   ├── ./src/hooks/use-proxy-events.ts
│   │   ├── ./src/hooks/use-sync-session.ts
│   │   ├── ./src/hooks/use-table-sorting.ts
│   │   ├── ./src/hooks/use-team-locks.ts
│   │   ├── ./src/hooks/use-update-notifications.tsx
│   │   ├── ./src/hooks/use-version-updater.ts
│   │   ├── ./src/hooks/use-vpn-events.ts
│   │   └── ./src/hooks/use-wayfern-terms.ts
│   ├── ./src/i18n
│   │   ├── ./src/i18n/index.ts
│   │   └── ./src/i18n/locales
│   │       ├── ./src/i18n/locales/en.json
│   │       ├── ./src/i18n/locales/es.json
│   │       ├── ./src/i18n/locales/fr.json
│   │       ├── ./src/i18n/locales/ja.json
│   │       ├── ./src/i18n/locales/pt.json
│   │       ├── ./src/i18n/locales/ru.json
│   │       └── ./src/i18n/locales/zh.json
│   ├── ./src/lib
│   │   ├── ./src/lib/backend-errors.ts
│   │   ├── ./src/lib/browser-utils.ts
│   │   ├── ./src/lib/error-utils.ts
│   │   ├── ./src/lib/flag-utils.ts
│   │   ├── ./src/lib/get-strict-context.tsx
│   │   ├── ./src/lib/logger.ts
│   │   ├── ./src/lib/name-utils.ts
│   │   ├── ./src/lib/slot.tsx
│   │   ├── ./src/lib/themes.ts
│   │   ├── ./src/lib/toast-utils.ts
│   │   └── ./src/lib/utils.ts
│   ├── ./src/styles
│   │   └── ./src/styles/globals.css
│   └── ./src/types.ts
├── ./src-tauri
│   ├── ./src-tauri/app.manifest
│   ├── ./src-tauri/app.rc
│   ├── ./src-tauri/assets
│   │   └── ./src-tauri/assets/template.pac
│   ├── ./src-tauri/binaries
│   ├── ./src-tauri/build.rs
│   ├── ./src-tauri/capabilities
│   │   └── ./src-tauri/capabilities/default.json
│   ├── ./src-tauri/Cargo.lock
│   ├── ./src-tauri/Cargo.toml
│   ├── ./src-tauri/copy-proxy-binary.mjs
│   ├── ./src-tauri/copy-proxy-binary.sh
│   ├── ./src-tauri/donut-browser-daemon
│   ├── ./src-tauri/donutbrowser.desktop
│   ├── ./src-tauri/entitlements.plist
│   ├── ./src-tauri/icons
│   │   ├── ./src-tauri/icons/128x128@2x.png
│   │   ├── ./src-tauri/icons/128x128.png
│   │   ├── ./src-tauri/icons/32x32.png
│   │   ├── ./src-tauri/icons/64x64.png
│   │   ├── ./src-tauri/icons/android
│   │   │   ├── ./src-tauri/icons/android/mipmap-hdpi
│   │   │   │   ├── ./src-tauri/icons/android/mipmap-hdpi/ic_launcher_foreground.png
│   │   │   │   ├── ./src-tauri/icons/android/mipmap-hdpi/ic_launcher.png
│   │   │   │   └── ./src-tauri/icons/android/mipmap-hdpi/ic_launcher_round.png
│   │   │   ├── ./src-tauri/icons/android/mipmap-mdpi
│   │   │   │   ├── ./src-tauri/icons/android/mipmap-mdpi/ic_launcher_foreground.png
│   │   │   │   ├── ./src-tauri/icons/android/mipmap-mdpi/ic_launcher.png
│   │   │   │   └── ./src-tauri/icons/android/mipmap-mdpi/ic_launcher_round.png
│   │   │   ├── ./src-tauri/icons/android/mipmap-xhdpi
│   │   │   │   ├── ./src-tauri/icons/android/mipmap-xhdpi/ic_launcher_foreground.png
│   │   │   │   ├── ./src-tauri/icons/android/mipmap-xhdpi/ic_launcher.png
│   │   │   │   └── ./src-tauri/icons/android/mipmap-xhdpi/ic_launcher_round.png
│   │   │   ├── ./src-tauri/icons/android/mipmap-xxhdpi
│   │   │   │   ├── ./src-tauri/icons/android/mipmap-xxhdpi/ic_launcher_foreground.png
│   │   │   │   ├── ./src-tauri/icons/android/mipmap-xxhdpi/ic_launcher.png
│   │   │   │   └── ./src-tauri/icons/android/mipmap-xxhdpi/ic_launcher_round.png
│   │   │   └── ./src-tauri/icons/android/mipmap-xxxhdpi
│   │   │       ├── ./src-tauri/icons/android/mipmap-xxxhdpi/ic_launcher_foreground.png
│   │   │       ├── ./src-tauri/icons/android/mipmap-xxxhdpi/ic_launcher.png
│   │   │       └── ./src-tauri/icons/android/mipmap-xxxhdpi/ic_launcher_round.png
│   │   ├── ./src-tauri/icons/icon.icns
│   │   ├── ./src-tauri/icons/icon.ico
│   │   ├── ./src-tauri/icons/icon.png
│   │   ├── ./src-tauri/icons/ios
│   │   │   ├── ./src-tauri/icons/ios/AppIcon-20x20@1x.png
│   │   │   ├── ./src-tauri/icons/ios/AppIcon-20x20@2x-1.png
│   │   │   ├── ./src-tauri/icons/ios/AppIcon-20x20@2x.png
│   │   │   ├── ./src-tauri/icons/ios/AppIcon-20x20@3x.png
│   │   │   ├── ./src-tauri/icons/ios/AppIcon-29x29@1x.png
│   │   │   ├── ./src-tauri/icons/ios/AppIcon-29x29@2x-1.png
│   │   │   ├── ./src-tauri/icons/ios/AppIcon-29x29@2x.png
│   │   │   ├── ./src-tauri/icons/ios/AppIcon-29x29@3x.png
│   │   │   ├── ./src-tauri/icons/ios/AppIcon-40x40@1x.png
│   │   │   ├── ./src-tauri/icons/ios/AppIcon-40x40@2x-1.png
│   │   │   ├── ./src-tauri/icons/ios/AppIcon-40x40@2x.png
│   │   │   ├── ./src-tauri/icons/ios/AppIcon-40x40@3x.png
│   │   │   ├── ./src-tauri/icons/ios/AppIcon-512@2x.png
│   │   │   ├── ./src-tauri/icons/ios/AppIcon-60x60@2x.png
│   │   │   ├── ./src-tauri/icons/ios/AppIcon-60x60@3x.png
│   │   │   ├── ./src-tauri/icons/ios/AppIcon-76x76@1x.png
│   │   │   ├── ./src-tauri/icons/ios/AppIcon-76x76@2x.png
│   │   │   └── ./src-tauri/icons/ios/AppIcon-83.5x83.5@2x.png
│   │   ├── ./src-tauri/icons/logo.png
│   │   ├── ./src-tauri/icons/Square107x107Logo.png
│   │   ├── ./src-tauri/icons/Square142x142Logo.png
│   │   ├── ./src-tauri/icons/Square150x150Logo.png
│   │   ├── ./src-tauri/icons/Square284x284Logo.png
│   │   ├── ./src-tauri/icons/Square30x30Logo.png
│   │   ├── ./src-tauri/icons/Square310x310Logo.png
│   │   ├── ./src-tauri/icons/Square44x44Logo.png
│   │   ├── ./src-tauri/icons/Square71x71Logo.png
│   │   ├── ./src-tauri/icons/Square89x89Logo.png
│   │   ├── ./src-tauri/icons/StoreLogo.png
│   │   ├── ./src-tauri/icons/tray-icon-22.png
│   │   ├── ./src-tauri/icons/tray-icon-44.png
│   │   ├── ./src-tauri/icons/tray-icon.svg
│   │   └── ./src-tauri/icons/tray-icon-win-44.png
│   ├── ./src-tauri/Info.plist
│   ├── ./src-tauri/src
│   │   ├── ./src-tauri/src/api_client.rs
│   │   ├── ./src-tauri/src/api_server.rs
│   │   ├── ./src-tauri/src/app_auto_updater.rs
│   │   ├── ./src-tauri/src/app_dirs.rs
│   │   ├── ./src-tauri/src/auto_updater.rs
│   │   ├── ./src-tauri/src/bin
│   │   │   ├── ./src-tauri/src/bin/donut_daemon.rs
│   │   │   └── ./src-tauri/src/bin/proxy_server.rs
│   │   ├── ./src-tauri/src/browser.rs
│   │   ├── ./src-tauri/src/browser_runner.rs
│   │   ├── ./src-tauri/src/browser_version_manager.rs
│   │   ├── ./src-tauri/src/camoufox
│   │   │   ├── ./src-tauri/src/camoufox/config.rs
│   │   │   ├── ./src-tauri/src/camoufox/data
│   │   │   │   ├── ./src-tauri/src/camoufox/data/browserforge.yml
│   │   │   │   ├── ./src-tauri/src/camoufox/data/browser-helper-file.json
│   │   │   │   ├── ./src-tauri/src/camoufox/data/fingerprint-network-definition.zip
│   │   │   │   ├── ./src-tauri/src/camoufox/data/fonts.json
│   │   │   │   ├── ./src-tauri/src/camoufox/data/header-network-definition.zip
│   │   │   │   ├── ./src-tauri/src/camoufox/data/headers-order.json
│   │   │   │   ├── ./src-tauri/src/camoufox/data/input-network-definition.zip
│   │   │   │   ├── ./src-tauri/src/camoufox/data/mod.rs
│   │   │   │   ├── ./src-tauri/src/camoufox/data/territoryInfo.xml
│   │   │   │   └── ./src-tauri/src/camoufox/data/webgl_data.db
│   │   │   ├── ./src-tauri/src/camoufox/env_vars.rs
│   │   │   ├── ./src-tauri/src/camoufox/fingerprint
│   │   │   │   ├── ./src-tauri/src/camoufox/fingerprint/bayesian_network.rs
│   │   │   │   ├── ./src-tauri/src/camoufox/fingerprint/bayesian_node.rs
│   │   │   │   ├── ./src-tauri/src/camoufox/fingerprint/mod.rs
│   │   │   │   └── ./src-tauri/src/camoufox/fingerprint/types.rs
│   │   │   ├── ./src-tauri/src/camoufox/fonts.rs
│   │   │   ├── ./src-tauri/src/camoufox/geolocation.rs
│   │   │   ├── ./src-tauri/src/camoufox/launcher.rs
│   │   │   ├── ./src-tauri/src/camoufox/mod.rs
│   │   │   └── ./src-tauri/src/camoufox/webgl.rs
│   │   ├── ./src-tauri/src/camoufox_manager.rs
│   │   ├── ./src-tauri/src/cloud_auth.rs
│   │   ├── ./src-tauri/src/commercial_license.rs
│   │   ├── ./src-tauri/src/cookie_manager.rs
│   │   ├── ./src-tauri/src/daemon
│   │   │   ├── ./src-tauri/src/daemon/autostart.rs
│   │   │   ├── ./src-tauri/src/daemon/mod.rs
│   │   │   ├── ./src-tauri/src/daemon/services.rs
│   │   │   └── ./src-tauri/src/daemon/tray.rs
│   │   ├── ./src-tauri/src/daemon_client.rs
│   │   ├── ./src-tauri/src/daemon_spawn.rs
│   │   ├── ./src-tauri/src/daemon_ws.rs
│   │   ├── ./src-tauri/src/default_browser.rs
│   │   ├── ./src-tauri/src/dns_blocklist.rs
│   │   ├── ./src-tauri/src/downloaded_browsers_registry.rs
│   │   ├── ./src-tauri/src/downloader.rs
│   │   ├── ./src-tauri/src/ephemeral_dirs.rs
│   │   ├── ./src-tauri/src/events
│   │   │   └── ./src-tauri/src/events/mod.rs
│   │   ├── ./src-tauri/src/extension_manager.rs
│   │   ├── ./src-tauri/src/extraction.rs
│   │   ├── ./src-tauri/src/geoip_downloader.rs
│   │   ├── ./src-tauri/src/group_manager.rs
│   │   ├── ./src-tauri/src/human_typing.rs
│   │   ├── ./src-tauri/src/ip_utils.rs
│   │   ├── ./src-tauri/src/lib.rs
│   │   ├── ./src-tauri/src/main.rs
│   │   ├── ./src-tauri/src/mcp_server.rs
│   │   ├── ./src-tauri/src/platform_browser.rs
│   │   ├── ./src-tauri/src/profile
│   │   │   ├── ./src-tauri/src/profile/encryption.rs
│   │   │   ├── ./src-tauri/src/profile/manager.rs
│   │   │   ├── ./src-tauri/src/profile/mod.rs
│   │   │   ├── ./src-tauri/src/profile/password.rs
│   │   │   └── ./src-tauri/src/profile/types.rs
│   │   ├── ./src-tauri/src/profile_importer.rs
│   │   ├── ./src-tauri/src/proxy_manager.rs
│   │   ├── ./src-tauri/src/proxy_runner.rs
│   │   ├── ./src-tauri/src/proxy_server.rs
│   │   ├── ./src-tauri/src/proxy_server_tests.rs
│   │   ├── ./src-tauri/src/proxy_storage.rs
│   │   ├── ./src-tauri/src/settings_manager.rs
│   │   ├── ./src-tauri/src/sync
│   │   │   ├── ./src-tauri/src/sync/client.rs
│   │   │   ├── ./src-tauri/src/sync/encryption.rs
│   │   │   ├── ./src-tauri/src/sync/engine.rs
│   │   │   ├── ./src-tauri/src/sync/manifest.rs
│   │   │   ├── ./src-tauri/src/sync/mod.rs
│   │   │   ├── ./src-tauri/src/sync/scheduler.rs
│   │   │   ├── ./src-tauri/src/sync/subscription.rs
│   │   │   └── ./src-tauri/src/sync/types.rs
│   │   ├── ./src-tauri/src/synchronizer.rs
│   │   ├── ./src-tauri/src/tag_manager.rs
│   │   ├── ./src-tauri/src/team_lock.rs
│   │   ├── ./src-tauri/src/traffic_stats.rs
│   │   ├── ./src-tauri/src/version_updater.rs
│   │   ├── ./src-tauri/src/vpn
│   │   │   ├── ./src-tauri/src/vpn/config.rs
│   │   │   ├── ./src-tauri/src/vpn/mod.rs
│   │   │   ├── ./src-tauri/src/vpn/socks5_server.rs
│   │   │   ├── ./src-tauri/src/vpn/storage.rs
│   │   │   ├── ./src-tauri/src/vpn/tunnel.rs
│   │   │   └── ./src-tauri/src/vpn/wireguard.rs
│   │   ├── ./src-tauri/src/vpn_worker_runner.rs
│   │   ├── ./src-tauri/src/vpn_worker_storage.rs
│   │   ├── ./src-tauri/src/wayfern_manager.rs
│   │   └── ./src-tauri/src/wayfern_terms.rs
│   ├── ./src-tauri/tauri.conf.json
│   ├── ./src-tauri/test-assets
│   │   ├── ./src-tauri/test-assets/test.tar.bz2
│   │   ├── ./src-tauri/test-assets/test.tar.gz
│   │   ├── ./src-tauri/test-assets/test.tar.xz
│   │   ├── ./src-tauri/test-assets/test.txt
│   │   └── ./src-tauri/test-assets/test.zip
│   └── ./src-tauri/tests
│       ├── ./src-tauri/tests/common
│       │   └── ./src-tauri/tests/common/mod.rs
│       ├── ./src-tauri/tests/donut_proxy_integration.rs
│       ├── ./src-tauri/tests/fixtures
│       │   └── ./src-tauri/tests/fixtures/test.conf
│       ├── ./src-tauri/tests/sync_e2e.rs
│       ├── ./src-tauri/tests/test_harness
│       │   └── ./src-tauri/tests/test_harness/mod.rs
│       └── ./src-tauri/tests/vpn_integration.rs
├── ./tailwind.config.js
├── ./tsconfig.json
└── ./_typos.toml
