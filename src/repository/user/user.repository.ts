import { Injectable } from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';
import type { User } from '@prisma/client';

@Injectable()
export class UserRepository {
  constructor(private prismaService: PrismaService) {}

  async findById(id: number): Promise<User | null> {
    try {
      return await (this.prismaService as any).user.findUnique({
        where: { id },
      });
    } catch (error) {
      console.error('Error finding user by ID:', error);
      throw new Error('Database operation failed');
    }
  }

  async create(data: any): Promise<any> {
    try {
      return await (this.prismaService as any).user.create({ data });
    } catch (error) {
      console.error('Error creating user:', error);
      if (error.code === 'P2002') {
        throw new Error('User already exists');
      }
      throw new Error('Database operation failed');
    }
  }
}
