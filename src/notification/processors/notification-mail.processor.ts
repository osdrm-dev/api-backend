import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { ResendService } from 'src/resend/resend.service';
import { ResendTemplate } from 'src/resend/resend.constants';
import {
  NOTIFICATION_MAIL_QUEUE,
  SEND_MAIL_JOB,
} from '../constants/notification.constants';

export interface SendMailJobData {
  to: string;
  subject: string;
  template: ResendTemplate;
  variables: Record<string, unknown>;
}

@Processor(NOTIFICATION_MAIL_QUEUE)
export class NotificationMailProcessor extends WorkerHost {
  private readonly logger = new Logger(NotificationMailProcessor.name);

  constructor(private readonly resendService: ResendService) {
    super();
  }

  async process(job: Job<SendMailJobData>): Promise<void> {
    if (job.name !== SEND_MAIL_JOB) return;

    const { to, subject, template, variables } = job.data;
    this.logger.debug(`Envoi email (template: ${template}) à ${to}`);
    await this.resendService.sendWithTemplate(to, subject, template, variables);
  }
}
