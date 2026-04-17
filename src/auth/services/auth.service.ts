import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { PrismaService } from 'prisma/prisma.service';
import { TokenService } from './token.service';
import { RegisterDto } from '../dto/register.dto';
import { LoginDto } from '../dto/login.dto';
import { ChangePasswordDto } from '../dto/change-password.dto';
import { ResetPasswordDto } from '../dto/reset-password.dto';
import { UpdateProfileDto } from '../dto/update-profile.dto';
import { UpdateUserDto } from '../dto/update-user.dto';
import type { User } from '@prisma/client';

type UserWithoutPassword = Omit<User, 'password'>;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokenService: TokenService,
    private readonly configService: ConfigService,
  ) {}

  async register(registerDto: RegisterDto) {
    const { email, password, name, fonction, role } = registerDto;

    const existingUser = await this.prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      throw new ConflictException(
        'Un compte existe déjà avec cette adresse email.',
      );
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const user = await this.prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
        fonction,
        role,
      },
    });

    return {
      user: this.excludePassword(user),
      message: 'Compte créé avec succès.',
    };
  }

  async login(loginDto: LoginDto, ipAddress?: string, userAgent?: string) {
    const { email, password } = loginDto;

    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      throw new UnauthorizedException(
        'Adresse email ou mot de passe incorrect.',
      );
    }

    if (!user.isActive) {
      throw new UnauthorizedException(
        'Votre compte a été désactivé. Veuillez contacter un administrateur.',
      );
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      throw new UnauthorizedException(
        'Adresse email ou mot de passe incorrect.',
      );
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    const tokens = await this.tokenService.generateTokens(
      user,
      ipAddress,
      userAgent,
    );

    return {
      user: this.excludePassword(user),
      ...tokens,
    };
  }

  async refreshTokens(refreshToken: string, ipAddress?: string) {
    return this.tokenService.refreshTokens(refreshToken, ipAddress);
  }

  async logout(userId: number, refreshToken?: string) {
    if (refreshToken) {
      await this.tokenService.revokeToken(refreshToken);
    }

    return { message: 'Déconnexion effectuée avec succès.' };
  }

  async logoutAll(userId: number) {
    await this.tokenService.revokeAllUserTokens(userId);

    return {
      message: 'Déconnexion effectuée sur tous les appareils avec succès.',
    };
  }

  async changePassword(userId: number, changePasswordDto: ChangePasswordDto) {
    const { oldPassword, newPassword } = changePasswordDto;

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('Aucun compte trouvé pour cet identifiant.');
    }

    const isOldPasswordValid = await bcrypt.compare(oldPassword, user.password);

    if (!isOldPasswordValid) {
      throw new BadRequestException('Le mot de passe actuel est incorrect.');
    }

    const hashedPassword = await bcrypt.hash(newPassword, 12);

    await this.prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword },
    });

    await this.tokenService.revokeAllUserTokens(userId);

    return {
      message: 'Mot de passe modifié avec succès. Veuillez vous reconnecter.',
    };
  }

  async resetPassword(resetPasswordDto: ResetPasswordDto) {
    const { email } = resetPasswordDto;

    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      throw new NotFoundException(
        'Aucun compte associé à cette adresse email.',
      );
    }

    const newPassword = this.generateRandomPassword();
    const hashedPassword = await bcrypt.hash(newPassword, 12);

    await this.prisma.user.update({
      where: { id: user.id },
      data: { password: hashedPassword },
    });

    await this.tokenService.revokeAllUserTokens(user.id);

    return {
      message: 'Mot de passe réinitialisé avec succès.',
      newPassword,
      email: user.email,
    };
  }

  async validateUser(
    email: string,
    password: string,
  ): Promise<UserWithoutPassword | null> {
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user || !user.isActive) {
      return null;
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      return null;
    }

    return user;
  }

  async getUserById(userId: number) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('Aucun compte trouvé pour cet identifiant.');
    }

    return this.excludePassword(user);
  }

  private generateRandomPassword(length: number = 12): string {
    const lowercase = 'abcdefghijklmnopqrstuvwxyz';
    const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const numbers = '0123456789';
    const symbols = '!@#$%^&*';
    const allChars = lowercase + uppercase + numbers + symbols;

    let password = '';
    password += lowercase[Math.floor(Math.random() * lowercase.length)];
    password += uppercase[Math.floor(Math.random() * uppercase.length)];
    password += numbers[Math.floor(Math.random() * numbers.length)];
    password += symbols[Math.floor(Math.random() * symbols.length)];

    for (let i = password.length; i < length; i++) {
      password += allChars[Math.floor(Math.random() * allChars.length)];
    }

    return password
      .split('')
      .sort(() => Math.random() - 0.5)
      .join('');
  }

  async updateProfile(userId: number, updateProfileDto: UpdateProfileDto) {
    const { email, ...otherData } = updateProfileDto;

    if (email) {
      const existingUser = await this.prisma.user.findUnique({
        where: { email },
      });

      if (existingUser && existingUser.id !== userId) {
        throw new ConflictException(
          'Cette adresse email est déjà utilisée par un autre compte.',
        );
      }
    }

    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: { email, ...otherData },
    });

    return {
      user: this.excludePassword(updatedUser),
      message: 'Profil mis à jour avec succès.',
    };
  }

  async updateUser(userId: number, updateUserDto: UpdateUserDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('Utilisateur introuvable.');
    }

    const { email, ...otherData } = updateUserDto;

    if (email) {
      const existingUser = await this.prisma.user.findUnique({
        where: { email },
      });

      if (existingUser && existingUser.id !== userId) {
        throw new ConflictException(
          'Cette adresse email est déjà utilisée par un autre compte.',
        );
      }
    }

    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: { email, ...otherData },
    });

    return {
      user: this.excludePassword(updatedUser),
      message: 'Utilisateur mis à jour avec succès.',
    };
  }

  async getActiveAcheteurs(): Promise<
    { id: number; name: string; email: string }[]
  > {
    return this.prisma.user.findMany({
      where: { role: 'ACHETEUR', isActive: true },
      select: { id: true, name: true, email: true },
      orderBy: { name: 'asc' },
    });
  }

  private excludePassword(user: User): UserWithoutPassword {
    const { password, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }
}
