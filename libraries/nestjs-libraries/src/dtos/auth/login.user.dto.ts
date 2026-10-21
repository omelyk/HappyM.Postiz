import {
  IsDefined,
  IsEmail,
  IsString,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { Provider } from '@prisma/client';
import { Transform } from 'class-transformer';

export class LoginUserDto {
  @IsString()
  @IsDefined()
  @ValidateIf((o) => !o.providerToken)
  @MinLength(3)
  password: string;

  @IsString()
  @IsDefined()
  provider: Provider;

  @IsString()
  @IsDefined()
  @ValidateIf((o) => !o.password)
  providerToken: string;

  @IsEmail()
  @IsDefined()
  @Transform(({ value }) => process.env.HAPPYM_APPLIANCE_MODE === 'true' &&
    typeof value === 'string' && value.trim().toLowerCase() === 'superadmin'
      ? 'superadmin@social-manager.local' : value)
  email: string;

  datafast_visitor_id: string;
}
