import { Body, Controller, Delete, Headers, HttpCode, Param, Put, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { BlockMode, BlocksService } from './blocks.service.js';
import { LocalOperatorGuard } from './local-operator.guard.js';
class SetBlockDto { @IsIn(['normal', 'full']) mode!: BlockMode; @IsOptional() @IsString() @MaxLength(1000) note?: string; }
class RemoveBlockDto { @IsOptional() @IsString() @MaxLength(1000) note?: string; }
@Controller('console/users') @UseGuards(LocalOperatorGuard)
export class BlocksController {
  constructor(private readonly blocks: BlocksService) {}
  @Put(':memberId/block') @HttpCode(204) async set(@Headers('x-application-key') key: string, @Param('memberId') memberId: string, @Body() body: SetBlockDto, @Req() request: Request & { operator: { accountId: string } }): Promise<void> { await this.blocks.set(key, memberId, body.mode, request.operator.accountId, body.note); }
  @Delete(':memberId/block') @HttpCode(204) async remove(@Headers('x-application-key') key: string, @Param('memberId') memberId: string, @Body() body: RemoveBlockDto, @Req() request: Request & { operator: { accountId: string } }): Promise<void> { await this.blocks.remove(key, memberId, request.operator.accountId, body.note); }
}