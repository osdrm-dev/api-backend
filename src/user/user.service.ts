import {
  Injectable,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from 'prisma/prisma.service';
import { MailService } from 'src/mail/mail.service';
import { UserRepository } from 'src/repository/user/user.repository';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserAdminDto } from './dto/update-user-admin.dto';
import { QueryUsersDto } from './dto/query-users.dto';
import type { Prisma } from '@prisma/client';
import type { User } from '@prisma/client';

type UserWithoutPassword = Omit<User, 'password'>;

@Injectable()
export class UserService {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly prisma: PrismaService,
    private readonly mailService: MailService,
  ) {}

  async findAll(query: QueryUsersDto) {
    const { role, isActive, search, skip = 0, take = 20 } = query;

    const where: Prisma.UserWhereInput = {
      ...(role && { role }),
      ...(isActive !== undefined && { isActive }),
      ...(search && {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
          { fonction: { contains: search, mode: 'insensitive' } },
        ],
      }),
    };

    const [users, total] = await Promise.all([
      this.userRepository.findMany({
        where,
        skip,
        take,
        orderBy: { name: 'asc' },
      }),
      this.userRepository.count(where),
    ]);

    return {
      data: users.map((u) => this.excludePassword(u)),
      pagination: {
        total,
        skip,
        take,
        totalPages: Math.ceil(total / take),
      },
    };
  }

  async findOne(id: number): Promise<UserWithoutPassword> {
    const user = await this.userRepository.findById(id);

    if (!user) {
      throw new NotFoundException('Utilisateur introuvable.');
    }

    return this.excludePassword(user);
  }

  async create(createUserDto: CreateUserDto) {
    const { email, name, fonction, role } = createUserDto;

    const existing = await this.userRepository.findByEmail(email);
    if (existing) {
      throw new ConflictException(
        'Un compte existe déjà avec cette adresse email.',
      );
    }

    const plainPassword = this.generatePassword();
    const hashedPassword = await bcrypt.hash(plainPassword, 12);

    const user = await this.userRepository.create({
      email,
      name,
      fonction,
      role,
      password: hashedPassword,
    });

    await this.sendWelcomeEmail(user.email, user.name, plainPassword);

    return {
      user: this.excludePassword(user),
      message:
        'Compte créé avec succès. Les identifiants ont été envoyés par email.',
    };
  }

  async update(id: number, dto: UpdateUserAdminDto) {
    const user = await this.userRepository.findById(id);
    if (!user) {
      throw new NotFoundException('Utilisateur introuvable.');
    }

    if (dto.email && dto.email !== user.email) {
      const existing = await this.userRepository.findByEmail(dto.email);
      if (existing) {
        throw new ConflictException(
          'Cette adresse email est déjà utilisée par un autre compte.',
        );
      }
    }

    const updated = await this.userRepository.update({
      where: { id },
      data: dto,
    });

    return {
      user: this.excludePassword(updated),
      message: 'Utilisateur mis à jour avec succès.',
    };
  }

  async remove(id: number) {
    const user = await this.userRepository.findById(id);
    if (!user) {
      throw new NotFoundException('Utilisateur introuvable.');
    }

    await this.prisma.refreshToken.deleteMany({ where: { userId: id } });
    await this.userRepository.delete({ id });

    return { message: 'Utilisateur supprimé avec succès.' };
  }

  async toggleActive(id: number) {
    const user = await this.userRepository.findById(id);
    if (!user) {
      throw new NotFoundException('Utilisateur introuvable.');
    }

    const updated = await this.userRepository.toggleActive(id, !user.isActive);

    return {
      user: this.excludePassword(updated),
      message: updated.isActive
        ? 'Compte activé avec succès.'
        : 'Compte désactivé avec succès.',
    };
  }

  async resetPassword(id: number) {
    const user = await this.userRepository.findById(id);
    if (!user) {
      throw new NotFoundException('Utilisateur introuvable.');
    }

    const plainPassword = this.generatePassword();
    const hashedPassword = await bcrypt.hash(plainPassword, 12);

    await this.userRepository.update({
      where: { id },
      data: { password: hashedPassword },
    });

    await this.prisma.refreshToken.deleteMany({ where: { userId: id } });

    await this.sendPasswordResetEmail(user.email, user.name, plainPassword);

    return {
      message:
        'Mot de passe réinitialisé. Les nouveaux identifiants ont été envoyés par email.',
    };
  }

  private generatePassword(length = 12): string {
    const lower = 'abcdefghijklmnopqrstuvwxyz';
    const upper = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const digits = '0123456789';
    const symbols = '!@#$%^&*';
    const all = lower + upper + digits + symbols;

    let pw = '';
    pw += lower[Math.floor(Math.random() * lower.length)];
    pw += upper[Math.floor(Math.random() * upper.length)];
    pw += digits[Math.floor(Math.random() * digits.length)];
    pw += symbols[Math.floor(Math.random() * symbols.length)];

    for (let i = pw.length; i < length; i++) {
      pw += all[Math.floor(Math.random() * all.length)];
    }

    return pw
      .split('')
      .sort(() => Math.random() - 0.5)
      .join('');
  }

  private async sendWelcomeEmail(
    email: string,
    name: string,
    password: string,
  ) {
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1a56db;">Bienvenue sur OSDRM</h2>
        <p>Bonjour <strong>${name}</strong>,</p>
        <p>Votre compte a été créé avec succès. Voici vos identifiants de connexion :</p>
        <div style="background: #f3f4f6; padding: 16px; border-radius: 8px; margin: 16px 0;">
          <p style="margin: 4px 0;"><strong>Email :</strong> ${email}</p>
          <p style="margin: 4px 0;"><strong>Mot de passe :</strong> <code style="background:#e5e7eb;padding:2px 6px;border-radius:4px;">${password}</code></p>
        </div>
        <p style="color: #ef4444;"><strong>Important :</strong> Veuillez changer votre mot de passe dès votre première connexion.</p>
        <p style="color: #6b7280; font-size: 13px;">Cet email a été généré automatiquement, merci de ne pas y répondre.</p>
      </div>
    `;

    await this.mailService.sendSimpleMail(
      email,
      'Vos identifiants OSDRM',
      html,
    );
  }

  private async sendPasswordResetEmail(
    email: string,
    name: string,
    password: string,
  ) {
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1a56db;">Réinitialisation de mot de passe</h2>
        <p>Bonjour <strong>${name}</strong>,</p>
        <p>Votre mot de passe a été réinitialisé par un administrateur. Voici vos nouveaux identifiants :</p>
        <div style="background: #f3f4f6; padding: 16px; border-radius: 8px; margin: 16px 0;">
          <p style="margin: 4px 0;"><strong>Email :</strong> ${email}</p>
          <p style="margin: 4px 0;"><strong>Nouveau mot de passe :</strong> <code style="background:#e5e7eb;padding:2px 6px;border-radius:4px;">${password}</code></p>
        </div>
        <p style="color: #ef4444;"><strong>Important :</strong> Veuillez changer ce mot de passe dès votre prochaine connexion.</p>
        <p style="color: #6b7280; font-size: 13px;">Cet email a été généré automatiquement, merci de ne pas y répondre.</p>
      </div>
    `;

    await this.mailService.sendSimpleMail(
      email,
      'Réinitialisation de votre mot de passe OSDRM',
      html,
    );
  }

  private excludePassword(user: User): UserWithoutPassword {
    const { password, ...rest } = user;
    return rest;
  }
}
