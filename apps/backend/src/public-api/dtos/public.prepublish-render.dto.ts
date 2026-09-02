import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
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
  @IsString() caption!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => PublicRenderedMediaDto)
  media!: PublicRenderedMediaDto[];

  @IsOptional()
  @ValidateNested()
  @Type(() => PublicRenderTargetExtrasDto)
  extras?: PublicRenderTargetExtrasDto;

  @IsOptional()
  @IsIn(['story_sequence'])
  @ApiPropertyOptional({ enum: ['story_sequence'] })
  publishMode?: 'story_sequence';
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

export class PublicStorySequenceChildReceiptDto {
  @ApiProperty() slideIndex!: number;
  @ApiProperty() mediaId!: string;
  @ApiProperty() providerId!: string;
  @ApiProperty() releaseUrl!: string;
  @ApiPropertyOptional() providerContainerId?: string;
  @ApiPropertyOptional() recovered?: boolean;
}

export class PublicStorySequencePublishReceiptDto {
  @ApiProperty() bundleId!: string;
  @ApiProperty({ enum: ['story_sequence'] }) mode!: 'story_sequence';
  @ApiProperty() provider!: string;
  @ApiProperty({ enum: ['Published', 'Failed'] })
  status!: 'Published' | 'Failed';
  @ApiProperty({ type: () => [PublicStorySequenceChildReceiptDto] })
  children!: PublicStorySequenceChildReceiptDto[];
}

export class PublicRenderOccurrenceDto {
  @ApiProperty() occurrenceId!: string;
  @ApiProperty() socialPostId!: string;
  @ApiProperty() integrationId!: string;
  @ApiProperty() sequence!: number;
  @ApiProperty() scheduledFor!: string;
  @ApiProperty() status!: string;
  @ApiProperty({ type: () => PublicRenderCorrelationDto })
  correlation!: PublicRenderCorrelationDto;
  @ApiPropertyOptional() leaseExpiresAt?: string;
  @ApiPropertyOptional() renderedAtUtc?: string;
  @ApiPropertyOptional() publishedAtUtc?: string;
  @ApiPropertyOptional() releaseId?: string;
  @ApiPropertyOptional() releaseUrl?: string;
  @ApiPropertyOptional({ type: () => PublicStorySequencePublishReceiptDto })
  publishReceipt?: PublicStorySequencePublishReceiptDto;
  @ApiPropertyOptional() reasonCode?: string;
}
