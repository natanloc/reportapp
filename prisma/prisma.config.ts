import { defineConfig } from '@prisma/config';
import * as dotenv from 'dotenv';
import { join } from 'path';

dotenv.config({ path: join(__dirname, '..', '.env') });

export default defineConfig({
  engine: 'classic', // Mude de library para classic aqui
  datasource: {
    url: process.env.DATABASE_URL as string,
  },
});
