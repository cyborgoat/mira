import { createApplication } from "./bootstrap/app";

async function bootstrap() {
  const { app, config } = await createApplication();

  await app.listen(config.get<number>("PORT", 8000), "0.0.0.0");
}

bootstrap();
