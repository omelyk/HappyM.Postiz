import {
  IsDefined,
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class ExchangeHappyMEmbedTicketDto {
  @IsDefined()
  @IsString()
  @MinLength(16)
  @MaxLength(2048)
  ticket: string;

  @IsOptional()
  @IsIn(['composer', 'connect'])
  purpose?: 'composer' | 'connect';

  @IsOptional()
  @IsString()
  @MaxLength(64)
  @Matches(/^[a-z0-9][a-z0-9-]*$/)
  provider?: string;
}
