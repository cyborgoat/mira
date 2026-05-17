import { INestApplication } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

export const parseCorsOrigins = (config: ConfigService): string[] =>
  config
    .get<string>("MIRA_CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

const isLocalhostLike = (origin: string) =>
  /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin);

const isAllowedOrigin = (origin: string, allowed: string[]) => {
  return allowed.includes(origin) || isLocalhostLike(origin);
};

export const configureCors = (app: INestApplication, config: ConfigService) => {
  const allowedOrigins = parseCorsOrigins(config);

  app.enableCors({
    origin: (origin, callback) => {
      if (!origin || isAllowedOrigin(origin, allowedOrigins)) {
        callback(null, true);
        return;
      }
      callback(new Error(`CORS origin not allowed: ${origin}`));
    },
    credentials: true,
  });
};
