import { Controller, Post, Body, Res } from '@nestjs/common';
import { AuthService } from './auth.service';
import { response } from 'express';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('register')
  async register(@Body() body: any) {
    return this.authService.register(body.email, body.password);
  }

  @Post('login')
  async login(
    @Body() body: any, 
    @Res({ passthrough: true }) response: Response // Adicione isso aqui!
  ) {
    // Agora o 'response' existe e pode ser passado para o service
    return this.authService.login(body.email, body.password, response);
  }

  @Post('logout')
  async logout(@Res({ passthrough: true }) response: any) {
    // limpamos o cookie enviando um com data de expiração no passado
    response.clearCookie('access_token', {
      httpOnly: true,
      secure: false, // Mude para true em produção (HTTPS)
      sameSite: 'lax',
    });

    return { message: 'Logout realizado com sucesso' };
  }
}