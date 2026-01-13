import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
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

  async register(registerDto: RegisterDto, ipAddress?: string) {
    const { email, password, name } = registerDto;

    // Vérifier si l'utilisateur existe déjà
    const existingUser = await this.prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      throw new ConflictException('User already exists with this email');
    }

    // Hasher le mot de passe
    const hashedPassword = await bcrypt.hash(password, 12);

    // Créer l'utilisateur
    const user = await this.prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
      },
    });

    // Audit log
    await this.auditService.log({
      userId: user.id,
      action: 'USER_REGISTERED',
      resource: 'User',
      resourceId: user.id.toString(),
      ipAddress,
    });

    // Générer les tokens
    const tokens = await this.tokenService.generateTokens(user, ipAddress);

    return {
      user: this.excludePassword(user),
      ...tokens,
    };
  }

  async login(loginDto: LoginDto, ipAddress?: string, userAgent?: string) {
    const { email, password } = loginDto;

    // Trouver l'utilisateur
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Vérifier si l'utilisateur est actif
    if (!user.isActive) {
      throw new UnauthorizedException('Account is deactivated');
    }

    // Vérifier le mot de passe
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Mettre à jour la dernière connexion
    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    // Audit log
    await this.auditService.log({
      userId: user.id,
      action: 'USER_LOGIN',
      resource: 'User',
      resourceId: user.id.toString(),
      ipAddress,
      userAgent,
    });

    // Générer les tokens
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

    // Audit log
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

    // Audit log
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

    // Vérifier l'ancien mot de passe
    const isOldPasswordValid = await bcrypt.compare(oldPassword, user.password);

    if (!isOldPasswordValid) {
      throw new BadRequestException('Old password is incorrect');
    }

    // Hasher le nouveau mot de passe
    const hashedPassword = await bcrypt.hash(newPassword, 12);

    // Mettre à jour le mot de passe
    await this.prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword },
    });

    // Révoquer tous les refresh tokens
    await this.tokenService.revokeAllUserTokens(userId);

    // Audit log
    await this.auditService.log({
      userId,
      action: 'PASSWORD_CHANGED',
      resource: 'User',
      resourceId: userId.toString(),
    });

    return { message: 'Password changed successfully' };
  }

  async requestPasswordReset(email: string) {
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      // Ne pas révéler si l'utilisateur existe
      return { message: 'If the email exists, a reset link will be sent' };
    }

    // Générer un token de réinitialisation
    const resetToken = await this.tokenService.generatePasswordResetToken(
      user.id,
    );

    // TODO: Envoyer un email avec le token
    // await this.emailService.sendPasswordResetEmail(user.email, resetToken);

    // Audit log
    await this.auditService.log({
      userId: user.id,
      action: 'PASSWORD_RESET_REQUESTED',
      resource: 'User',
      resourceId: user.id.toString(),
    });

    return { message: 'If the email exists, a reset link will be sent' };
  }

  async resetPassword(resetPasswordDto: ResetPasswordDto) {
    const { token, newPassword } = resetPasswordDto;

    // Vérifier le token
    const passwordReset = await this.prisma.passwordReset.findUnique({
      where: { token },
      include: { user: true },
    });

    if (!passwordReset) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    if (passwordReset.usedAt) {
      throw new BadRequestException('Reset token has already been used');
    }

    if (passwordReset.expiresAt < new Date()) {
      throw new BadRequestException('Reset token has expired');
    }

    // Hasher le nouveau mot de passe
    const hashedPassword = await bcrypt.hash(newPassword, 12);

    // Mettre à jour le mot de passe
    await this.prisma.user.update({
      where: { id: passwordReset.userId },
      data: { password: hashedPassword },
    });

    // Marquer le token comme utilisé
    await this.prisma.passwordReset.update({
      where: { id: passwordReset.id },
      data: { usedAt: new Date() },
    });

    // Révoquer tous les refresh tokens
    await this.tokenService.revokeAllUserTokens(passwordReset.userId);

    // Audit log
    await this.auditService.log({
      userId: passwordReset.userId,
      action: 'PASSWORD_RESET_COMPLETED',
      resource: 'User',
      resourceId: passwordReset.userId.toString(),
    });

    return { message: 'Password reset successfully' };
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

  private excludePassword(user: User) {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }
}
