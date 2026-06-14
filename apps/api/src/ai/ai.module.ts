import { Module } from "@nestjs/common";
import { AiManualInterceptor } from "./ai-manual.interceptor";
import { AiRequestContextService } from "./ai-request-context.service";
import { AiService } from "./ai.service";
import { LlmConfigService } from "./llm-config.service";

@Module({
  providers: [AiService, LlmConfigService, AiRequestContextService, AiManualInterceptor],
  exports: [AiService, LlmConfigService, AiRequestContextService, AiManualInterceptor],
})
export class AiModule {}
