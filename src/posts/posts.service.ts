import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreatePostDto } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import { InjectModel } from '@nestjs/mongoose';
import { isValidObjectId, Model } from 'mongoose';
import { Post } from 'src/schemas/post.schema';
import { User } from 'src/schemas/user.schema';
import { Category } from 'src/schemas/category.schema';

@Injectable()
export class PostsService {
  constructor(
    @InjectModel(Post.name) private postModel: Model<Post>,
    @InjectModel(User.name) private userModel: Model<User>,
    @InjectModel(Category.name) private categoryModel: Model<Category>,
  ) {}
  // CREATE NEW POST
  async create(createPostDto: CreatePostDto) {
    const { categoryIds, authorId, ...postData } = createPostDto;

    // Ensure at least one category is provided
    if (!categoryIds || categoryIds.length === 0)
      throw new BadRequestException('At least one category is required');

    // Validate authorId
    if (!authorId) throw new BadRequestException('Author ID is required');

    // Validate author ID
    if (!isValidObjectId(authorId))
      throw new BadRequestException('Invalid author ID');

    // Validate all category IDs
    for (const categoryId of categoryIds) {
      if (!isValidObjectId(categoryId))
        throw new BadRequestException(`Invalid category ID: ${categoryId}`);
    }

    // Verify that author exists
    const author = await this.userModel.findById(authorId);
    if (!author) throw new BadRequestException('Author does not exist');

    // Verify that all categories exist
    const categories = await this.categoryModel.find({
      _id: { $in: categoryIds },
    });
    if (categories.length !== categoryIds.length)
      throw new BadRequestException('One or more categories do not exist');

    const post = new this.postModel({
      ...postData,
      authorId: authorId,
      categories: categoryIds,
    });
    await post.save();

    // Add reference to this post in the author's posts array
    await this.userModel.findByIdAndUpdate(
      authorId,
      {
        $push: { posts: post._id },
      },
      { new: true },
    );

    // Add reference to each category in the post's categories array
    await this.categoryModel.updateMany(
      { _id: { $in: categoryIds } },
      { $push: { posts: post._id } },
    );

    // Populate author and categories before returning
    await post.populate([
      { path: 'authorId', select: 'id username email' },
      { path: 'categories', select: 'id name' },
    ]);
    return post;
  }

  // GET ALL POSTS (with optional published filter and pagination)
  async findAll(published?: boolean, skip?: number, take?: number) {
    const offset = skip || 0;
    const limit = Math.min(take ?? 10, 100); // Default 10, max 100

    const filter = published !== undefined ? { published } : {};

    // Fetch posts with filters, pagination, and populate author and categories
    const posts = await this.postModel
      .find(filter)
      .skip(offset)
      .limit(limit)
      .populate([
        { path: 'authorId', select: 'id username email' },
        { path: 'categories', select: 'id name' },
      ])
      .sort({ createdAt: -1 });

    return posts;
  }

  // GET A SINGLE POST BY ID (Increment viewCount atomatically)
  async findOne(id: string) {
    // Validate post ID
    if (!isValidObjectId(id)) throw new NotFoundException('Invalid post ID');

    // Check if the post exists
    const existingPost = await this.postModel.findById(id).exec();
    if (!existingPost)
      throw new NotFoundException(`Post with ID ${id} not found`);

    const post = await this.postModel
      .findByIdAndUpdate(
        id,
        { $inc: { viewCount: 1 } },
        { new: true }, // Return the updated document
      )
      .populate({
        path: 'authorId',
        select: 'id username email',
      })
      .populate({
        path: 'categories',
        select: 'id name',
      })
      .exec();

    if (!post) throw new NotFoundException(`Post with ID ${id} not found`);
    return post;
  }

  // UPDATE A POST
  async update(id: string, updatePostDto: UpdatePostDto) {
    // Validate post ID
    if (!isValidObjectId(id)) throw new NotFoundException('Invalid post ID');

    const { categoryIds, authorId, ...postData } = updatePostDto;

    // Validate author ID if provided
    if (authorId && !isValidObjectId(authorId))
      throw new BadRequestException('Invalid author ID');

    // Validate category IDs if provided
    if (categoryIds) {
      for (const categoryId of categoryIds) {
        if (!isValidObjectId(categoryId))
          throw new BadRequestException(`Invalid category ID: ${categoryId}`);
      }

      // Verify that all categories exist
      const categories = await this.categoryModel.find({
        _id: { $in: categoryIds },
      });
      if (categories.length !== categoryIds.length)
        throw new BadRequestException('One or more categories do not exist');
    }

    // Verify that author exists if authorId is provided
    if (authorId) {
      const author = await this.userModel.findById(authorId);
      if (!author) throw new BadRequestException('Author does not exist');
    }
    // Check if the post exists
    const existingPost = await this.postModel.findById(id).exec();
    if (!existingPost)
      throw new NotFoundException(`Post with ID ${id} not found`);

    // Handle authorId change
    if (authorId && authorId !== existingPost.authorId.toString()) {
      // Remove post reference from old author
      await this.userModel.findByIdAndUpdate(existingPost.authorId, {
        $pull: { posts: id },
      });

      // Add post reference to new author
      await this.userModel.findByIdAndUpdate(authorId, {
        $addToSet: { posts: id },
      });
    }
    // Handle categoryIds change
    if (categoryIds) {
      const existingCategoryIds = existingPost.categories.map((c) =>
        c.toString(),
      );
      const categoriesToAdd = categoryIds;

      // Remove post reference from old categories
      const categoriesToRemove = existingCategoryIds.filter(
        (catId) => !categoriesToAdd.includes(catId),
      );
      if (categoriesToRemove.length > 0) {
        await this.categoryModel.updateMany(
          { _id: { $in: categoriesToRemove } },
          { $pull: { posts: id } },
        );
      }

      // Add post reference to new categories
      const categoriesToActuallyAdd = categoriesToAdd.filter(
        (catId) => !existingCategoryIds.includes(catId),
      );
      if (categoriesToActuallyAdd.length > 0) {
        await this.categoryModel.updateMany(
          { _id: { $in: categoriesToActuallyAdd } },
          { $push: { posts: id } },
        );
      }
    }

    // Check for actual changes
    const hasDataChanges = Object.keys(postData).some(
      (key) => postData[key] !== existingPost[key],
    );
    const existingCategoryIds = existingPost.categories.map((c) =>
      c.toString(),
    );
    const hasCategoryChanges =
      categoryIds &&
      (existingCategoryIds.some((catId) => !categoryIds?.includes(catId)) ||
        categoryIds.length !== existingCategoryIds.length);

    if (!hasDataChanges && !hasCategoryChanges && !authorId)
      throw new ConflictException('No changes detected in the update data');

    // Build update object
    const updateData: any = { ...postData };
    if (authorId) updateData.authorId = authorId;
    if (categoryIds) updateData.categories = categoryIds;

    // Proceed with the update
    const updatedPost = await this.postModel
      .findByIdAndUpdate(id, updateData, {
        new: true,
      })
      .populate({
        path: 'authorId',
        select: 'id username email',
      })
      .populate({
        path: 'categories',
        select: 'id name',
      })
      .exec();
    return updatedPost;
  }

  // DELETE A POST
  async remove(id: string) {
    // Validate post ID
    if (!isValidObjectId(id)) throw new NotFoundException('Invalid post ID');

    // Check if the post exists and delete
    const existingPost = await this.postModel.findById(id).exec();
    if (!existingPost)
      throw new NotFoundException(`Post with ID ${id} not found`);

    const deletedPost = await this.postModel
      .findByIdAndDelete(id)
      .populate({
        path: 'authorId',
        select: 'id username email',
      })
      .populate({
        path: 'categories',
        select: 'id name',
      })
      .exec();

    if (!deletedPost)
      throw new NotFoundException(`Post with ID ${id} not found`);

    // Remove references to this post in users' posts arrays
    await this.userModel.findByIdAndUpdate(deletedPost.authorId, {
      $pull: { posts: id },
    });

    // Remove references to this post in categories' posts arrays
    const categoryIds = deletedPost.categories.map((cat) => cat._id || cat);
    await this.categoryModel.updateMany(
      { _id: { $in: categoryIds } },
      { $pull: { posts: id } },
    );

    return deletedPost;
  }

  // SEARCH POSTS BY KEYWORD IN TITLE OR CONTENT
  async searchPosts(query: string) {
    if (!query || query.trim() === '') {
      throw new BadRequestException('Search query cannot be empty');
    }

    const posts = await this.postModel
      .find({ $text: { $search: query } })
      .populate({
        path: 'authorId',
        select: 'id username email',
      })
      .populate({
        path: 'categories',
        select: 'id name',
      })
      .exec();

    return posts;
  }
}
