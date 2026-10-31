import { Module } from '@nestjs/common';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { HealthController } from './health.controller.js';
import { ConfigModule } from './config.module.js';

@Module({
  imports: [ConfigModule],
  controllers: [AppController, HealthController],
  providers: [AppService],
})
export class AppModule {}
