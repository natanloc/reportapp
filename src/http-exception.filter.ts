import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';
import { Response } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: any, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    
    // Identifica se é um erro controlado do Nest ou um erro genérico (tipo erro da Meta)
    const status = exception instanceof HttpException
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;

    // Log para você ver no terminal o que aconteceu de verdade
    // console.error('--- ERRO CAPTURADO PELO FILTRO ---');
    // console.error(exception?.response?.data || exception.message);

    // Resposta amigável para o seu Front-end
    const message = exception?.response?.data?.error?.message || exception.message || 'Erro interno no servidor';

    response.status(status).json({
      success: false,
      statusCode: status,
      timestamp: new Date().toISOString(),
      message: message.includes('access token') 
        ? 'Sua conexão com o Facebook expirou. Por favor, reconecte sua conta.' 
        : message,
    });
  }
}