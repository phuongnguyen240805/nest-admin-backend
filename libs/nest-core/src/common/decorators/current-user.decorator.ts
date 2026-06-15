import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * @CurrentUser() decorator
 *
 * Extracts the authenticated user object from the request.
 * Assumes that an AuthGuard (e.g. JwtAuthGuard) has already attached `user` to the request.
 *
 * Usage in controller:
 *   @Get('me')
 *   getProfile(@CurrentUser() user: UserEntity) {
 *     return user;
 *   }
 *
 * The user object typically comes from JWT payload + database lookup in the strategy.
 */
export const CurrentUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  },
);
