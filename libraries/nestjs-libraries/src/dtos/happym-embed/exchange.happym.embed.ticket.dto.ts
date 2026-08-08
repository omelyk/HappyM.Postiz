import { IsDefined, IsString, MaxLength, MinLength } from 'class-validator';

export class ExchangeHappyMEmbedTicketDto {
  @IsDefined()
  @IsString()
  @MinLength(16)
  @MaxLength(2048)
  ticket: string;
}
