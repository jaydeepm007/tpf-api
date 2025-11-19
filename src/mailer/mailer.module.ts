import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MailerService } from './mailer.service';

@Module({
	// ConfigModule is imported so MailerService can read EMAIL and EMAIL_PASSWORD
	imports: [ConfigModule],
	providers: [MailerService],
	exports: [MailerService],
})
export class MailerModule {}
