import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { NextFunction, Request, Response } from 'express';
import { AppModule } from './app.module.js';
import { OriginGuardMiddleware } from './origin-guard.middleware.js';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('v1');
  const originGuard = app.get(OriginGuardMiddleware);
  app.use((request: Request, response: Response, next: NextFunction) => originGuard.use(request, response, next));
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  const document = SwaggerModule.createDocument(app, new DocumentBuilder().setTitle('Comment API').setVersion('v1').addBearerAuth().build());
  SwaggerModule.setup('v1/docs', app, document);
  app.enableShutdownHooks();
  await app.listen(Number(process.env.PORT ?? 3000), '0.0.0.0');
}

void bootstrap();