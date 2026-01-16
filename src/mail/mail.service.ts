import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { MailerService } from '@nestjs-modules/mailer';
import { Logger } from '@nestjs/common';

@Injectable()
export class MailService {
  constructor(private readonly mailer: MailerService) {}
  private readonly logger = new Logger(MailService.name);

  async sendSimpleMail(to: string, subject: string, content: string) {
    try {
      await this.mailer.sendMail({
        to,
        subject,
        html: content,
      });
      this.logger.log('Email envoyé');
    } catch (error) {
      this.logger.error(
        'Error sending email:',
         error.stack
      );

      throw new InternalServerErrorException();
    }
  }

  async sendWithAttachment(to: string, filePath: string) {
    try{ 
      await this.mailer.sendMail({
        to,
        subject: 'Document joint',
        html: '<p>Veuillez trouver le document en pièce jointe.</p>',
        attachments: [
          {
            filename: 'document.pdf',
            path: filePath,
          },
        ],
      });
    }catch (error){
      this.logger.error(
        'Erreur, email non envoyé',
        error.stack 
      );
      throw new InternalServerErrorException();

    }
  }

  async sendConfirmation(to: string, token: string) {
    try {
      await this.mailer.sendMail({
        to,
        subject: 'Confirmation email',
        template: 'confirmation',
        context: {
          link: `http://localhost:3000/confirm?token=${token}`,
        },
      });
    }catch (error) {
      this.logger.error(
        'email de confirmation non envoyé',
        error.stack
      );
    }
  }
}
