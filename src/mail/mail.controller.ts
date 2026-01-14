import { Controller, Post } from '@nestjs/common';
import { MailService } from './mail.service';

@Controller('mail')
export class MailController {
  constructor(private readonly mailService: MailService) {}

  @Post('test-mail')
  sendTestMail() {
    return this.mailService.sendSimpleMail(
      'test@test.com',
      'Test MailHog',
      '<p>Email OK 🚀</p>',
    );
  }
}
