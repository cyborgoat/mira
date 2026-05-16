import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import { AuthUser } from "./current-user";

@Injectable()
export class SuperuserGuard implements CanActivate {
  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<{ user?: AuthUser }>();
    if (!request.user?.isSuperuser) {
      throw new ForbiddenException("Superuser access required");
    }
    return true;
  }
}
