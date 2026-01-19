import { Controller, Get, Res, Query, Param } from '@nestjs/common';
import { MetaService } from './meta.service';
import { type Response } from 'express';

@Controller('meta')
export class MetaController {
  constructor(private readonly metaService: MetaService) {}

  @Get('connect')
  connect(@Res() res: Response) {
    const url = this.metaService.getAuthorizationUrl();
    return res.redirect(url);
  }

  @Get('callback')
  async callback(@Query('code') code: string) {
    if (!code) {
      return { error: 'O usuário negou o acesso ou ocorreu um erro.' };
    }

    const result = await this.metaService.handleFacebookCallback(code);

    return {
      message: 'Token de 60 dias gerado com sucesso!',
      result,
    };
  }

  @Get('sync-accounts/:clientId')
  async syncAccounts(@Param('clientId') clientId: string) {
    const accounts = await this.metaService.listAdAccounts(clientId);
    return {
      message: 'Contas de anúncios sincronizadas!',
      accounts,
    };
  }

  @Get('insights/:adAccountId')
  async getInsights(
    @Param('adAccountId') adAccountId: string,
    @Query('start') start: string, // Ex: 2024-01-01
    @Query('end') end: string,     // Ex: 2024-01-10
  ) {
    return await this.metaService.getLiveInsights(adAccountId, start, end);
  }
}
