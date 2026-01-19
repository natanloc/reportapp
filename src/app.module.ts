import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MetaModule } from './meta/meta.module';
import { PrismaService } from './prisma.service';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), MetaModule],
  controllers: [],
  providers: [PrismaService],
})
export class AppModule {}
