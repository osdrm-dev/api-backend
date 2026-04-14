import {
  Injectable,
  Logger,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';
import * as Handlebars from 'handlebars';
import * as fs from 'fs';
import * as path from 'path';
import { ResendTemplate } from './resend.constants';

@Injectable()
export class ResendService {
  private readonly logger = new Logger(ResendService.name);
  private readonly client: Resend;
  private readonly from: string;
  private readonly templatesDir: string;

  constructor(private readonly config: ConfigService) {
    this.client = new Resend(config.get<string>('RESEND_API_KEY'));
    this.from =
      config.get<string>('RESEND_FROM') ?? 'OSDRM <no-reply@osdrm.mg>';
    this.templatesDir = path.join(__dirname, 'templates');
  }

  async sendSimpleMail(
    to: string,
    subject: string,
    html: string,
  ): Promise<void> {
    try {
      await this.client.emails.send({ from: this.from, to, subject, html });
      this.logger.log(`Email envoyé à ${to} — ${subject}`);
    } catch (error) {
      this.logger.error('Erreur envoi email simple', (error as Error).stack);
      throw new InternalServerErrorException();
    }
  }

  async sendWithAttachment(
    to: string,
    subject: string,
    filePath: string,
  ): Promise<void> {
    try {
      const content = fs.readFileSync(filePath);
      const filename = path.basename(filePath);

      await this.client.emails.send({
        from: this.from,
        to,
        subject,
        html: '<p>Veuillez trouver le document en pièce jointe.</p>',
        attachments: [{ filename, content }],
      });

      this.logger.log(`Email avec pièce jointe envoyé à ${to}`);
    } catch (error) {
      this.logger.error(
        'Erreur envoi email avec pièce jointe',
        (error as Error).stack,
      );
      throw new InternalServerErrorException();
    }
  }

  async sendWithTemplate(
    to: string,
    subject: string,
    template: ResendTemplate,
    variables: Record<string, unknown>,
  ): Promise<void> {
    try {
      const html = this.renderTemplate(template, variables);
      await this.client.emails.send({ from: this.from, to, subject, html });
      this.logger.log(`Email (template: ${template}) envoyé à ${to}`);
    } catch (error) {
      console.log('errr ', to, error);
      this.logger.error(
        `Erreur envoi email template ${template}`,
        (error as Error).stack,
      );
      throw new InternalServerErrorException();
    }
  }

  async sendConfirmation(to: string, token: string): Promise<void> {
    const frontendUrl =
      this.config.get<string>('RESEND_FRONTEND_URL') ?? 'http://localhost:5173';
    await this.sendWithTemplate(
      to,
      'Réinitialisation de votre mot de passe',
      'confirmation',
      { link: `${frontendUrl}/reset-password?token=${token}` },
    );
  }

  private renderTemplate(
    template: ResendTemplate,
    variables: Record<string, unknown>,
  ): string {
    const filePath = path.join(this.templatesDir, `${template}.hbs`);
    const source = fs.readFileSync(filePath, 'utf8');
    const compiled = Handlebars.compile(source);
    return compiled(variables);
  }
}
