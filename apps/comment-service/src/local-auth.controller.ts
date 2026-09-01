import { Body, Controller, Post, UseGuards, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { IsIn, IsString, MinLength } from 'class-validator';
import { SignJWT } from 'jose';
import { LocalOnlyGuard } from './local-only.guard.js';
import { DatabaseService } from './database.service.js';

class LocalLoginDto {
  @IsString()
  username!: string;

  @IsString()
  @MinLength(1)
  password!: string;
}

const localMemberKeys = ['author', 'reactor', 'reporter-one', 'reporter-two', 'reporter-three', 'reporter-four', 'reporter-five', 'new-user'] as const;
type LocalMemberKey = (typeof localMemberKeys)[number];

class IssueMemberTokenDto {
  @IsIn(localMemberKeys)
  user!: LocalMemberKey;
}

const localMembers = {
  author: { accountId: 'local-author', name: 'Author', avaterUrl: 'https://example.test/avatar/author.png', createdAt: '2026-01-01T00:00:00.000Z' },
  reactor: { accountId: 'local-reactor', name: 'Reactor', avaterUrl: 'https://example.test/avatar/reactor.png', createdAt: '2026-01-01T00:00:00.000Z' },
  'reporter-one': { accountId: 'local-reporter-1', name: 'Reporter One', avaterUrl: 'https://example.test/avatar/reporter-1.png', createdAt: '2026-01-01T00:00:00.000Z' },
  'reporter-two': { accountId: 'local-reporter-2', name: 'Reporter Two', avaterUrl: 'https://example.test/avatar/reporter-2.png', createdAt: '2026-01-01T00:00:00.000Z' },
  'reporter-three': { accountId: 'local-reporter-3', name: 'Reporter Three', avaterUrl: 'https://example.test/avatar/reporter-3.png', createdAt: '2026-01-01T00:00:00.000Z' },
  'reporter-four': { accountId: 'local-reporter-4', name: 'Reporter Four', avaterUrl: 'https://example.test/avatar/reporter-4.png', createdAt: '2026-01-01T00:00:00.000Z' },
  'reporter-five': { accountId: 'local-reporter-5', name: 'Reporter Five', avaterUrl: 'https://example.test/avatar/reporter-5.png', createdAt: '2026-01-01T00:00:00.000Z' },
  'new-user': { accountId: 'local-new-user', name: 'New User', avaterUrl: 'https://example.test/avatar/new-user.png', createdAt: new Date().toISOString() }
} as const;

@Controller('local/auth')
@UseGuards(LocalOnlyGuard)
export class LocalAuthController {
  constructor(private readonly database: DatabaseService) {}

  @Post('operator/login')
  async login(@Body() body: LocalLoginDto): Promise<{ accessToken: string }> {
    const result = await this.database.query<{ password_hash: string }>(
      'SELECT password_hash FROM local_operators WHERE username = $1',
      [body.username]
    );
    if (result.rowCount !== 1 || !(await bcrypt.compare(body.password, result.rows[0].password_hash))) {
      throw new UnauthorizedException({ code: 'invalid_credentials', message: 'Invalid local credentials' });
    }
    return { accessToken: await this.token({ sub: 'local-operator', role: 'operator' }) };
  }

  @Post('member/token')
  async memberToken(@Body() body: IssueMemberTokenDto): Promise<{ accessToken: string }> {
    return { accessToken: await this.token({ ...localMembers[body.user], role: 'member' }) };
  }

  private token(payload: Record<string, string>): Promise<string> {
    const secret = new TextEncoder().encode(process.env.LOCAL_JWT_SECRET);
    return new SignJWT(payload).setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('15m').sign(secret);
  }
}