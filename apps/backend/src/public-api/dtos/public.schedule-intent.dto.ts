import { IsString, MaxLength, Matches } from 'class-validator';

export class PublicScheduleIntentRequestDto {
  @IsString()
  @MaxLength(262144)
  payloadJson!: string;

  @IsString()
  @Matches(/^sha256-[a-f0-9]{64}$/)
  payloadHash!: string;
}
