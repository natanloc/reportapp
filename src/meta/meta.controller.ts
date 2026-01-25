import { Controller, Get, Res, Query, Param, UseGuards } from '@nestjs/common';
import { MetaService } from './meta.service';
import { type Response } from 'express';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { GetUser } from 'src/auth/get-user.decorator';

@UseGuards(JwtAuthGuard)
@Controller('meta')
export class MetaController {
  constructor(private readonly metaService: MetaService) {}

  @Get('connect')
  connect(@Res() res: Response) {
    const url = this.metaService.getAuthorizationUrl();
    return res.redirect(url);
  }

  @Get('facebook-connection')
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

  @Get('account-insights/:adAccountId')
  async getInsights(
    @Param('adAccountId') adAccountId: string,
    @Query('start') start: string,
    @Query('end') end: string,
  ) {
    return await this.metaService.getLiveInsights(adAccountId, start, end);
  }

  @Get('list-campaigns/:adAccountId')
  async listCampaigns(
    @Param('adAccountId') adAccountId: string,
    @GetUser() user: { userId: string }
  ) {
    return this.metaService.listCampaigns(user.userId, adAccountId);
  }

  @Get('list-adsets/:campaignId')
  async getAdSets(
    @Param('campaignId') campaignId: string,
    @GetUser() user: { userId: string }
  ) {
    return this.metaService.listAdSets(campaignId, user.userId);
  }

  @Get('list-ads/:adSetId')
  async getAds(@Param('adSetId') adSetId: string, @Query('clientId') clientId: string) {
    return this.metaService.listAds(adSetId, clientId);
  }

  @Get('insights/:objectId')
  async getFlexibleInsights(
    @Param('objectId') objectId: string,
    @GetUser() user: { userId: string, email: string },
    @Query('start') start?: string,
    @Query('end') end?: string,
  ) {
    
    return this.metaService.getGenericInsights(objectId, user.userId, start, end);
  }
}
