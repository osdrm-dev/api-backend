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
import { AuditService } from './audit.service';
import { RegisterDto } from '../dto/register.dto';
import { LoginDto } from '../dto/login.dto';
import { ChangePasswordDto } from '../dto/change-password.dto';
import { ResetPasswordDto } from '../dto/reset-password.dto';
import { User } from '@prisma/client';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokenService: TokenService,
    private readonly auditService: AuditService,
    private readonly configService: ConfigService,
  ) {}

  async register(
    registerDto: RegisterDto,
    ipAddress?: string,
    adminId?: number,
  ) {
    const { email, password, name, fonction, role } = registerDto;

    const existingUser = await this.prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      throw new ConflictException('User already exists with this email');
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

    await this.auditService.log({
      userId: adminId,
      action: 'USER_CREATED',
      resource: 'User',
      resourceId: user.id.toString(),
      details: {
        createdUserId: user.id,
        createdUserEmail: email,
        createdUserRole: role,
      },
      ipAddress,
    });

    return {
      user: this.excludePassword(user),
      message: 'User successfully created',
    };
  }

  async login(loginDto: LoginDto, ipAddress?: string, userAgent?: string) {
    const { email, password } = loginDto;

    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('Account is deactivated');
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    await this.auditService.log({
      userId: user.id,
      action: 'USER_LOGIN',
      resource: 'User',
      resourceId: user.id.toString(),
      ipAddress,
      userAgent,
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

    await this.auditService.log({
      userId,
      action: 'USER_LOGOUT',
      resource: 'User',
      resourceId: userId.toString(),
    });

    return { message: 'Logged out successfully' };
  }

  async logoutAll(userId: number) {
    await this.tokenService.revokeAllUserTokens(userId);

    await this.auditService.log({
      userId,
      action: 'USER_LOGOUT_ALL',
      resource: 'User',
      resourceId: userId.toString(),
    });

    return { message: 'Logged out from all devices successfully' };
  }

  async changePassword(userId: number, changePasswordDto: ChangePasswordDto) {
    const { oldPassword, newPassword } = changePasswordDto;

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const isOldPasswordValid = await bcrypt.compare(oldPassword, user.password);

    if (!isOldPasswordValid) {
      throw new BadRequestException('Old password is incorrect');
    }

    const hashedPassword = await bcrypt.hash(newPassword, 12);

    await this.prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword },
    });

    await this.tokenService.revokeAllUserTokens(userId);

    await this.auditService.log({
      userId,
      action: 'PASSWORD_CHANGED',
      resource: 'User',
      resourceId: userId.toString(),
    });

    return { message: 'Password changed successfully' };
  }

  async resetPassword(
    resetPasswordDto: ResetPasswordDto,
    adminId: number,
    ipAddress?: string,
  ) {
    const { email } = resetPasswordDto;

    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const newPassword = this.generateRandomPassword();
    const hashedPassword = await bcrypt.hash(newPassword, 12);

    await this.prisma.user.update({
      where: { id: user.id },
      data: { password: hashedPassword },
    });

    await this.tokenService.revokeAllUserTokens(user.id);

    await this.auditService.log({
      userId: adminId,
      action: 'PASSWORD_RESET_BY_ADMIN',
      resource: 'User',
      resourceId: user.id.toString(),
      details: {
        targetUserId: user.id,
        targetUserEmail: email,
      },
      ipAddress,
    });

    return {
      message: 'Password reset successfully',
      newPassword,
      email: user.email,
    };
  }

  async validateUser(email: string, password: string): Promise<User | null> {
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
      throw new NotFoundException('User not found');
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

  private excludePassword(user: User) {
    const { password, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }
}
