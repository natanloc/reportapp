import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MetaModule } from './meta/meta.module';
import { PrismaService } from './prisma.service';
import { AuthModule } from './auth/auth.module';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), MetaModule, AuthModule],
  controllers: [],
  providers: [PrismaService],
})
export class AppModule {}
