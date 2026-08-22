import {
  IsDefined,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class PublicYoutubePublishDto {
  @IsString()
  @IsDefined()
  accountId: string;

  @IsString()
  @IsOptional()
  videoMediaId?: string;

  @IsString()
  @IsOptional()
  videoPath?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(100)
  title: string;

  @IsString()
  @MaxLength(5000)
  @IsOptional()
  description?: string;

  @IsIn(['yt-video', 'yt-shorts'])
  formatHint: 'yt-video' | 'yt-shorts';

  @IsString()
  @IsOptional()
  thumbnailMediaId?: string;

  @IsString()
  @IsOptional()
  thumbnailPath?: string;
}
