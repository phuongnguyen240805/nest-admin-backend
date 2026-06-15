/**
 * Local common barrel for ladipage-backend.
 * 
 * This allows modules inside the app to import from a relative or local path:
 *   import { BaseEntity, CurrentUser, PaginationDto } from '../common';
 *
 * All core implementations live in the shared library @liora/nest-core
 * for maximum reusability across the whole monorepo (other apps, future projects).
 */

// Re-export everything from the shared foundation
export * from '@liora/nest-core/common';

// You can add app-specific common utilities, constants, or overrides below
// Example: export * from './ladipage-specific.util';
