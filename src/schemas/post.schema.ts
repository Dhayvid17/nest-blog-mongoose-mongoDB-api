import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { Document } from 'mongoose';
import { User } from './user.schema';
import { Category } from './category.schema';

@Schema({ timestamps: true })
export class Post extends Document {
  @Prop({ required: true, trim: true })
  title: string;

  @Prop({ required: true, trim: true })
  content: string;

  @Prop({ default: false })
  published: boolean;

  @Prop({ default: 0 })
  viewCount: number;

  // ADD RELATIONSHIP ON POST => USER MANY TO ONE FIELD
  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true })
  authorId: User;

  // ADD RELATIONSHIP ON POST => CATEGORY[] MANY TO MANY FIELD
  @Prop({
    type: [
      { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true },
    ],
  })
  categories: Category[];
}

export const PostSchema = SchemaFactory.createForClass(Post);
