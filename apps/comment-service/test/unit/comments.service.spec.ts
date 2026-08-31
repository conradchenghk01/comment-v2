import { BadRequestException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { CommentsService } from '../../src/comments.service.js';

describe('CommentsService', () => {
  const service = new CommentsService({} as never);
  const validate = (body: string) => (service as unknown as { validateBody(value: string): void }).validateBody(body);

  it('US-10: rejects whitespace-only comments', () => {
    expect(() => validate(' \n\t ')).toThrow(BadRequestException);
  });

  it('US-10: accepts 1,000 grapheme clusters and rejects 1,001', () => {
    expect(() => validate('a'.repeat(1000))).not.toThrow();
    expect(() => validate('a'.repeat(1001))).toThrow(BadRequestException);
  });
});