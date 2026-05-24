import { INestApplication } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "../app.module";
import { configureCors } from "./cors.config";
import { configureValidation } from "./pipes.config";

export const createApplication = async () => {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

  configureCors(app, config);
  configureValidation(app);

  return { app, config };
};
