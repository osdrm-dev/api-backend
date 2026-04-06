import { Injectable } from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class BudgetTableRepository {
  constructor(private readonly prisma: PrismaService) {}

  findActive() {
    return this.prisma.budgetTable.findFirst({
      where: { isActive: true, isPending: false },
      include: {
        projects: true,
        uploadedBy: { select: { id: true, name: true, email: true } },
        file: true,
      },
    });
  }

  findActiveProjects() {
    return this.prisma.budgetTable.findFirst({
      where: { isActive: true, isPending: false },
      include: { projects: true },
    });
  }

  findById(id: number) {
    return this.prisma.budgetTable.findUnique({
      where: { id },
      include: {
        projects: true,
        uploadedBy: { select: { id: true, name: true, email: true } },
        file: true,
      },
    });
  }

  async findMany(skip: number, take: number) {
    const [data, total] = await Promise.all([
      this.prisma.budgetTable.findMany({
        where: { isPending: false },
        include: {
          uploadedBy: { select: { id: true, name: true, email: true } },
          _count: { select: { projects: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.budgetTable.count({ where: { isPending: false } }),
    ]);
    return { data, total };
  }

  async getNextVersion(): Promise<number> {
    const last = await this.prisma.budgetTable.findFirst({
      orderBy: { version: 'desc' },
      select: { version: true },
    });
    return (last?.version ?? 0) + 1;
  }

  createPending(
    data: Prisma.BudgetTableCreateInput,
    projects: Prisma.BudgetProjectCreateManyBudgetTableInput[],
  ) {
    return this.prisma.budgetTable.create({
      data: {
        ...data,
        projects: { createMany: { data: projects } },
      },
      include: { projects: true },
    });
  }

  async activateInTransaction(budgetTableId: number) {
    return this.prisma.$transaction(async (tx) => {
      const target = await tx.budgetTable.findUnique({
        where: { id: budgetTableId },
      });
      if (!target) return null;

      await tx.budgetTable.updateMany({
        where: { isActive: true },
        data: { isActive: false },
      });

      const activated = await tx.budgetTable.update({
        where: { id: budgetTableId },
        data: {
          isActive: true,
          isPending: false,
          activatedAt: new Date(),
        },
        include: {
          projects: true,
          uploadedBy: { select: { id: true, name: true, email: true } },
        },
      });

      return activated;
    });
  }
}
