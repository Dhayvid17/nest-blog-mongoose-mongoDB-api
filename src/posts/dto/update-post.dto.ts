import { PartialType } from '@nestjs/mapped-types';
import { CreatePostDto } from './create-post.dto';
import {
  IsString,
  IsBoolean,
  IsOptional,
  IsArray,
  MaxLength,
  MinLength,
  ArrayUnique,
  ArrayMinSize,
  IsMongoId,
} from 'class-validator';
import { Transform } from 'class-transformer';

export class UpdatePostDto extends PartialType(CreatePostDto) {
  @IsString()
  @IsOptional()
  @MaxLength(200)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  title?: string;

  @IsString()
  @IsOptional()
  @MinLength(10, { message: 'Content must be at least 10 characters long' })
  @MaxLength(20000)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  content?: string;

  @IsBoolean()
  @IsOptional()
  published?: boolean;

  @IsMongoId({ message: 'Invalid author ID format' })
  @IsOptional()
  authorId?: string;

  @IsArray()
  @ArrayUnique()
  @ArrayMinSize(1, { message: 'At least one category is required' })
  @IsMongoId({ each: true, message: 'Invalid category ID format' })
  @IsOptional()
  categoryIds?: string[];
}
