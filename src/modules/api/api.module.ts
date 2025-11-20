import { Module } from '@nestjs/common';
import { ApiController } from '../../routes/api';
import { ApiService } from '../../services/api.service';

@Module({
  imports: [],
  controllers: [ApiController],
  providers: [ApiService],
  exports: [ApiService],
})
export class ApiModule {}
