import { Injectable } from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';
import type { User, Prisma, Role } from '@prisma/client';

@Injectable()
export class UserRepository {
  constructor(private prisma: PrismaService) {}

  //Trouver un utilisateur par ID
  async findById(id: number): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { id },
    });
  }

  //Trouver un utilisateur par email
  async findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { email },
    });
  }

  //Trouver plusieurs utilisateur
  async findMany(params: {
    skip?: number;
    take?: number;
    where?: Prisma.UserWhereInput;
    orderBy?: Prisma.UserOrderByWithRelationInput;
  }): Promise<User[]> {
    const { skip, take, where, orderBy } = params;

    return this.prisma.user.findMany({
      skip,
      take,
      where,
      orderBy,
    });
  }

  //Compte les utilisateurs
  async count(where?: Prisma.UserWhereInput): Promise<number> {
    return this.prisma.user.count({ where });
  }

  //Creer un utilisateur
  async create(data: Prisma.UserCreateInput): Promise<User> {
    return this.prisma.user.create({ data });
  }

  //Mettre a jour un utilisateur
  async update(params: {
    where: Prisma.UserWhereUniqueInput;
    data: Prisma.UserUpdateInput;
  }): Promise<User> {
    const { where, data } = params;
    return this.prisma.user.update({ where, data });
  }

  //Supprime un utilisateur
  async delete(where: Prisma.UserWhereUniqueInput): Promise<User> {
    return this.prisma.user.delete({ where });
  }

  //Trouver un utilisateur par role
  async findByRole(role: Role): Promise<User[]> {
    return this.findMany({
      where: { role },
      orderBy: { name: 'asc' },
    });
  }

  //Trouver les utilisateurs actifs
  async findActive(): Promise<User[]> {
    return this.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    });
  }

  //Récupère le rôle d'un utilisateur
  async getUserRole(id: number): Promise<Role | null> {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: { role: true },
    });
    return user?.role || null;
  }

  //Récupère les informations essentielles d'un utilisateur
  async getUserInfo(id: number): Promise<{
    id: number;
    name: string;
    email: string;
    role: Role;
  } | null> {
    return this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
      },
    });
  }

  //Mettre a jour la derniere connexion
  async updateLastLogin(id: number): Promise<User> {
    return this.update({
      where: { id },
      data: { lastLoginAt: new Date() },
    });
  }

  //Activer,Desactiver un utilisateur
  async toggleActive(id: number, isActive: boolean): Promise<User> {
    return this.update({
      where: { id },
      data: { isActive },
    });
  }
}
