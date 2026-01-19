import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { MetaService } from './meta.service';
import { MetaController } from './meta.controller';
import { PrismaService } from '../prisma.service';

@Module({
  imports: [HttpModule],
  controllers: [MetaController],
  providers: [MetaService, PrismaService],
})
export class MetaModule {}
