import { Injectable } from '@nestjs/common';
import { User, Prisma } from '../../../generated/prisma';
import { PrismaService } from 'prisma/prisma.service';

@Injectable()
export class UserRepository {
  constructor(private prismaService: PrismaService) {}

  async findById(id: number): Promise<User | null> {
    try {
      return await this.prismaService.user.findUnique({ where: { id } });
    } catch (error) {
      console.error('Error finding user by ID:', error);
      throw new Error('Database operation failed');
    }
  }

  async create(data: Prisma.UserCreateInput): Promise<User> {
    try {
      return await this.prismaService.user.create({ data });
    } catch (error) {
      console.error('Error creating user:', error);
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        throw new Error('User already exists');
      }
      throw new Error('Database operation failed');
    }
  }
}
