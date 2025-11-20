import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import * as bodyParser from 'body-parser';  
import * as dotenv from 'dotenv';
dotenv.config();

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  // Swagger configuration
  const config = new DocumentBuilder()
    .setTitle('TPF Backend API')
    .setDescription('The TPF Backend API documentation')
    .setVersion('1.0')
    .addTag('tpf')
    .addBearerAuth()
    .build();
  
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);

  // Accept raw text body
  app.use(bodyParser.text({ type: '*/*' }));
  app.enableCors();
  app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
  const port = process.env.PORT || 3000;
  await app.listen(port);
  // minimal console feedback
  // eslint-disable-next-line no-console
  console.log(`Nest application listening on port ${port}`);
  console.log(`Swagger documentation available at http://localhost:${port}/api`);
}

bootstrap();