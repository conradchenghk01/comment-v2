import { writeFile } from 'node:fs/promises';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module.js';

async function generate(): Promise<void> {
  const app = await NestFactory.create(AppModule, { logger: false });
  app.setGlobalPrefix('v1');
  const document = SwaggerModule.createDocument(app, new DocumentBuilder().setTitle('Comment API').setVersion('v1').addBearerAuth().build());
  await writeFile('openapi.json', `${JSON.stringify(document, null, 2)}\n`);
  await app.close();
}

void generate();