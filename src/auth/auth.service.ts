import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  async register(email: string, password: string) {
    // 1. Verifica se o usuário já existe
    const userExists = await this.prisma.user.findUnique({ where: { email } });
    if (userExists) {
      // No NestJS, é melhor usar o BadRequestException para erros de validação
      throw new BadRequestException('Este e-mail já está cadastrado');
    }

    // 2. Gera o Hash da senha
    const hashedPassword = await bcrypt.hash(password, 10);

    // 3. Salva no banco
    const newUser = await this.prisma.user.create({
      data: {
        email,
        password: hashedPassword,
      },
    });

    // CORREÇÃO AQUI: Removemos a senha do objeto antes de retornar
    const { password: _, ...result } = newUser; 
    return result;
  }

  async login(email: string, password: string, response: any) {
    const user = await this.prisma.user.findUnique({ where: { email } });

    if (!user) {
      throw new UnauthorizedException('E-mail ou senha inválidos');
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      throw new UnauthorizedException('E-mail ou senha inválidos');
    }

    const payload = { sub: user.id, email: user.email };

    // MUDANÇA AQUI: Passamos a secret explicitamente para evitar o erro de 'undefined'
    const token = this.jwtService.sign(payload, {
      secret: this.configService.get<string>('JWT_SECRET'),
    });

    response.cookie('access_token', token, {
      httpOnly: true,
      secure: false, 
      sameSite: 'lax', 
      maxAge: 1000 * 60 * 60 * 24,
    });

    return {
      message: 'Login realizado com sucesso'
    };
  }
}