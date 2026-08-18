import {
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class PublicChatMessageDto {
  @IsString()
  @MinLength(1)
  @MaxLength(16_000)
  message!: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  @Matches(/^[A-Za-z0-9_-]+$/)
  threadId?: string;
}
