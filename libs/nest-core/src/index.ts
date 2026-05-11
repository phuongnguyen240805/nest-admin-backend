/**
 * Barrel file chính của nest-core library
 * Export tất cả những gì bên ngoài cần dùng
 */

// Common utilities
export * from './common';

// Config
export * from './config';

// Constants
export * from './constants';

// Global env
export * from './global';

// Helper & Utils
export * from './helper';
export * from './utils';

// Socket
export * from './socket';

// Modules chính (chỉ export những module cần thiết)
// export * from './modules/auth';
// export * from './modules/system';
// export * from './modules/user';
// export * from './modules/tools';
// export * from './modules/todo';
// export * from './modules/netdisk';
// export * from './modules/tasks';
// export * from './modules/sse';
// export * from './modules/agent';
// export * from './modules/billing';
// export * from './modules/tenant';

// Một số entity hay dùng trực tiếp
export * from './modules/system/menu/menu.entity';
export * from './modules/system/role/role.entity';
export * from './modules/system/dept/dept.entity';
// export thêm entity khác khi cần

// Re-export một số type quan trọng
export type * from './config';
