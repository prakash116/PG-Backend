/** Allows a request only when the signed-in user holds one of the listed roles. */
import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '../../../generated/prisma/client';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { AuthenticatedRequest } from './jwt-auth.guard';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const allowedRoles = this.reflector.getAllAndOverride<
      UserRole[] | undefined
    >(ROLES_KEY, [context.getHandler(), context.getClass()]);

    // No @Roles on the route means any authenticated user may continue.
    if (!allowedRoles || allowedRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const sessionUser = request.sessionUser;

    // JwtAuthGuard populates sessionUser and must run first. If it is missing,
    // fail closed rather than silently allowing the request through.
    if (!sessionUser) {
      throw new ForbiddenException('You do not have access to this resource.');
    }

    if (!allowedRoles.includes(sessionUser.role)) {
      throw new ForbiddenException('You do not have access to this resource.');
    }

    return true;
  }
}
