import { Injectable, HttpStatus } from '@nestjs/common';
import { AppException, ErrorCode } from 'src/common/errors';
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
      throw new AppException(
        HttpStatus.CONFLICT,
        ErrorCode.USER_EMAIL_ALREADY_EXISTS,
        'A user with this email already exists',
        {
          fields: [
            { field: 'email', code: ErrorCode.USER_EMAIL_ALREADY_EXISTS },
          ],
        },
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
      throw new AppException(
        HttpStatus.UNAUTHORIZED,
        ErrorCode.AUTH_INVALID_CREDENTIALS,
        'Invalid credentials',
      );
    }

    if (!user.isActive) {
      throw new AppException(
        HttpStatus.UNAUTHORIZED,
        ErrorCode.AUTH_ACCOUNT_DISABLED,
        'Account is disabled',
      );
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      throw new AppException(
        HttpStatus.UNAUTHORIZED,
        ErrorCode.AUTH_INVALID_CREDENTIALS,
        'Invalid credentials',
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
      throw new AppException(
        HttpStatus.NOT_FOUND,
        ErrorCode.NOT_FOUND,
        'User not found',
      );
    }

    const isOldPasswordValid = await bcrypt.compare(oldPassword, user.password);

    if (!isOldPasswordValid) {
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        ErrorCode.AUTH_CURRENT_PASSWORD_INCORRECT,
        'Current password is incorrect',
        {
          fields: [
            {
              field: 'oldPassword',
              code: ErrorCode.AUTH_CURRENT_PASSWORD_INCORRECT,
            },
          ],
        },
      );
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
      throw new AppException(
        HttpStatus.NOT_FOUND,
        ErrorCode.AUTH_ACCOUNT_NOT_FOUND,
        'No account found for this email',
        {
          fields: [{ field: 'email', code: ErrorCode.AUTH_ACCOUNT_NOT_FOUND }],
        },
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
      throw new AppException(
        HttpStatus.NOT_FOUND,
        ErrorCode.NOT_FOUND,
        'User not found',
      );
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
        throw new AppException(
          HttpStatus.CONFLICT,
          ErrorCode.USER_EMAIL_ALREADY_EXISTS,
          'A user with this email already exists',
          {
            fields: [
              { field: 'email', code: ErrorCode.USER_EMAIL_ALREADY_EXISTS },
            ],
          },
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
      throw new AppException(
        HttpStatus.NOT_FOUND,
        ErrorCode.NOT_FOUND,
        'User not found',
      );
    }

    const { email, ...otherData } = updateUserDto;

    if (email) {
      const existingUser = await this.prisma.user.findUnique({
        where: { email },
      });

      if (existingUser && existingUser.id !== userId) {
        throw new AppException(
          HttpStatus.CONFLICT,
          ErrorCode.USER_EMAIL_ALREADY_EXISTS,
          'A user with this email already exists',
          {
            fields: [
              { field: 'email', code: ErrorCode.USER_EMAIL_ALREADY_EXISTS },
            ],
          },
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

  async getUsers(): Promise<UserWithoutPassword[]> {
    const users = await this.prisma.user.findMany({
      orderBy: { name: 'asc' },
    });
    return users.map((u) => this.excludePassword(u));
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
