import { Injectable } from '@nestjs/common';
import { MailerService } from '@nestjs-modules/mailer';

@Injectable()
export class MailService {
  constructor(private readonly mailer: MailerService) {}

  sendSimpleMail(to: string, subject: string, content: string) {
    return this.mailer.sendMail({
      to,
      subject,
      html: content,
    });
  }

  sendWithAttachment(to: string, filePath: string) {
    return this.mailer.sendMail({
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
  }

  sendConfirmation(to: string, token: string) {
    return this.mailer.sendMail({
      to,
      subject: 'Confirmation email',
      template: 'confirmation',
      context: {
        link: `http://localhost:3000/confirm?token=${token}`,
      },
    });
  }
}
