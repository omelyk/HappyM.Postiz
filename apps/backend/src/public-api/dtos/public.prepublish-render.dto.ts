import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsISO8601,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

export class PublicClaimRenderDto {
  @IsString()
  @IsNotEmpty()
  workerId!: string;

  @IsOptional()
  @IsInt()
  @Min(60)
  @Max(900)
  leaseSeconds?: number;
}

export class PublicRenderCorrelationDto {
  @IsString() @IsNotEmpty() crmSocialPostId!: string;
  @IsString() @IsNotEmpty() snapshotId!: string;
  @IsString() @IsNotEmpty() pharmacyGroupId!: string;
  @IsOptional() @IsString() pharmacyId?: string;
}

export class PublicRenderedMediaDto {
  @IsString() @IsNotEmpty() mediaId!: string;
  @IsIn(['image', 'video']) kind!: 'image' | 'video';
  @IsString() @IsNotEmpty() mime!: string;
}

export class PublicRenderTargetExtrasDto {
  @IsOptional() @IsString() youtubeTitle?: string;
  @IsOptional() @IsString() thumbnailMediaId?: string;
}

export class PublicRenderTargetDto {
  @IsString() @IsNotEmpty() integrationId!: string;
  @IsString() @IsNotEmpty() channel!: string;
  @IsString() @IsNotEmpty() caption!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => PublicRenderedMediaDto)
  media!: PublicRenderedMediaDto[];

  @IsOptional()
  @ValidateNested()
  @Type(() => PublicRenderTargetExtrasDto)
  extras?: PublicRenderTargetExtrasDto;
}

export class PublicAttachRenderedDto {
  @IsString() @IsNotEmpty() renderToken!: string;

  @ValidateNested()
  @Type(() => PublicRenderCorrelationDto)
  correlation!: PublicRenderCorrelationDto;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => PublicRenderTargetDto)
  targets!: PublicRenderTargetDto[];

  @IsISO8601() renderedAtUtc!: string;
  @IsString() @IsNotEmpty() contentHash!: string;
}
