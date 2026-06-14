import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from "@nestjs/common";
import { Observable } from "rxjs";
import { AiRequestContextService } from "./ai-request-context.service";

@Injectable()
export class AiManualInterceptor implements NestInterceptor {
  constructor(private readonly aiContext: AiRequestContextService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<{ headers?: Record<string, string | string[] | undefined> }>();
    const header = request.headers?.["x-mira-ai-manual"];
    const manual = header === "1";
    return this.aiContext.run({ manual }, () => next.handle());
  }
}
