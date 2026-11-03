import { IsString, MaxLength, MinLength } from 'class-validator';

export class InitialAdminPasswordDto {
  @IsString()
  @MinLength(1)
  @MaxLength(2048)
  token: string;

  @IsString()
  @MinLength(12)
  @MaxLength(256)
  password: string;
}
