import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { EnvService } from './config/env';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  // All routes live under /api so Traefik can route PathPrefix(`/api`) to this service.
  app.setGlobalPrefix('api');
  app.enableCors({ origin: true, credentials: true });

  const env = app.get(EnvService);
  await app.listen(env.values.API_PORT, '0.0.0.0');
  // eslint-disable-next-line no-console
  console.log(`api listening on :${env.values.API_PORT}`);
}

void bootstrap();
