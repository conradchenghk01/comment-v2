import { Body, Controller, Delete, Get, Headers, HttpCode, Param, Post, Req, UseGuards } from '@nestjs/common';
import { IsString, MaxLength, MinLength } from 'class-validator';
import { Request } from 'express';
import { LocalOperatorGuard } from './local-operator.guard.js';
import { SensitiveWord, SensitiveWordsService } from './sensitive-words.service.js';

class CreateSensitiveWordDto { @IsString() @MinLength(1) @MaxLength(100) word!: string; }

@Controller('console/sensitive-words')
@UseGuards(LocalOperatorGuard)
export class SensitiveWordsController {
  constructor(private readonly sensitiveWords: SensitiveWordsService) {}

  @Get()
  list(@Headers('x-application-key') applicationKey: string): Promise<SensitiveWord[]> { return this.sensitiveWords.list(applicationKey); }

  @Post()
  add(@Headers('x-application-key') applicationKey: string, @Body() body: CreateSensitiveWordDto, @Req() request: Request & { operator: { accountId: string } }): Promise<SensitiveWord> { return this.sensitiveWords.add(applicationKey, body.word, request.operator.accountId); }

  @Delete(':wordId')
  @HttpCode(204)
  remove(@Headers('x-application-key') applicationKey: string, @Param('wordId') wordId: string, @Req() request: Request & { operator: { accountId: string } }): Promise<void> { return this.sensitiveWords.remove(applicationKey, wordId, request.operator.accountId); }
}