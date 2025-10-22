import {
  IsNotEmpty,
  IsString,
  IsBoolean,
  IsOptional,
  IsArray,
  MaxLength,
  MinLength,
  ArrayUnique,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';

export class CreatePostDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(10)
  @MaxLength(20000)
  content: string;

  @IsBoolean()
  @IsOptional()
  published?: boolean;

  @Type(() => String)
  @IsNotEmpty()
  authorId: string;

  @ArrayUnique()
  @IsArray()
  @IsNotEmpty()
  @Type(() => String)
  @Transform(({ value }) => {
    if (Array.isArray(value) && value.length === 0) {
      throw new Error('At least one category is required');
    }
    return value;
  })
  categoryIds: string[];
}
