import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { MailerService } from '@nestjs-modules/mailer';
import { Logger } from '@nestjs/common';
import { Queue } from 'bullmq';
import { MAIL_QUEUE, SEND_MAIL_JOB } from './constants/mail.constants';

@Injectable()
export class MailService {
  constructor(
    private readonly mailer: MailerService,
    @InjectQueue(MAIL_QUEUE) private readonly mailQueue: Queue,
  ) {}
  private readonly logger = new Logger(MailService.name);

  async sendSimpleMail(to: string, subject: string, content: string) {
    try {
      await this.mailQueue.add(SEND_MAIL_JOB, {
        to,
        subject,
        html: content,
      });
      this.logger.log(`Email mis en file d'attente pour ${to}`);
    } catch (error) {
      this.logger.error('Error queueing email:', (error as Error).stack);

      throw new InternalServerErrorException();
    }
  }

  async sendWithAttachment(to: string, filePath: string) {
    try {
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
    } catch (error) {
      this.logger.error('Erreur, email non envoyé', (error as Error).stack);
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
    } catch (error) {
      this.logger.error(
        'email de confirmation non envoyé',
        (error as Error).stack,
      );
    }
  }
}
