import { Injectable } from "@nestjs/common";
import { AsyncLocalStorage } from "node:async_hooks";

export type AiRequestContext = {
  manual: boolean;
};

@Injectable()
export class AiRequestContextService {
  private readonly storage = new AsyncLocalStorage<AiRequestContext>();

  run<T>(context: AiRequestContext, fn: () => T): T {
    return this.storage.run(context, fn);
  }

  isManual(): boolean {
    return this.storage.getStore()?.manual === true;
  }
}
