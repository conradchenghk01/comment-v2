import { Body, Controller, Delete, Headers, HttpCode, Param, Put, UseGuards } from '@nestjs/common';
import { IsIn } from 'class-validator';
import { BlockMode, BlocksService } from './blocks.service.js';
import { LocalOperatorGuard } from './local-operator.guard.js';
class SetBlockDto { @IsIn(['normal', 'full']) mode!: BlockMode; }
@Controller('console/users') @UseGuards(LocalOperatorGuard)
export class BlocksController {
  constructor(private readonly blocks: BlocksService) {}
  @Put(':memberId/block') @HttpCode(204) async set(@Headers('x-application-key') key: string, @Param('memberId') memberId: string, @Body() body: SetBlockDto): Promise<void> { await this.blocks.set(key, memberId, body.mode); }
  @Delete(':memberId/block') @HttpCode(204) async remove(@Headers('x-application-key') key: string, @Param('memberId') memberId: string): Promise<void> { await this.blocks.remove(key, memberId); }
}