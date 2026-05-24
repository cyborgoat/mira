import { Module } from "@nestjs/common";
import { AiService } from "./ai.service";
import { LlmConfigService } from "./llm-config.service";

@Module({
  providers: [AiService, LlmConfigService],
  exports: [AiService, LlmConfigService],
})
export class AiModule {}
