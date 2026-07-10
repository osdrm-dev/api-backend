import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { MailerService } from '@nestjs-modules/mailer';
import { Job } from 'bullmq';
import { MAIL_QUEUE, SEND_MAIL_JOB } from '../constants/mail.constants';

export interface SendMailJobData {
  to: string;
  subject: string;
  html: string;
}

@Processor(MAIL_QUEUE)
export class MailProcessor extends WorkerHost {
  private readonly logger = new Logger(MailProcessor.name);

  constructor(private readonly mailer: MailerService) {
    super();
  }

  async process(job: Job<SendMailJobData>): Promise<void> {
    if (job.name !== SEND_MAIL_JOB) return;

    const { to, subject, html } = job.data;

    try {
      await this.mailer.sendMail({ to, subject, html });
      this.logger.log(`Email envoyé à ${to}`);
    } catch (error) {
      this.logger.error(`Erreur envoi email à ${to}`, (error as Error).stack);
      throw error;
    }
  }
}
