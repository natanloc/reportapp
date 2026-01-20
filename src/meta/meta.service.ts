import { HttpService } from '@nestjs/axios';
import { Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { lastValueFrom } from 'rxjs';
import { PrismaService } from 'src/prisma.service';

@Injectable()
export class MetaService {
  constructor(
    private configService: ConfigService,
    private httpService: HttpService,
    private prisma: PrismaService,
  ) {}

  getAuthorizationUrl() {
    const appId = this.configService.get<string>('META_APP_ID');
    const redirectUri = this.configService.get<string>('META_REDIRECT_URI');

    const scope = [
      'ads_read',
      'business_management'
    ].join(',');

    return `https://www.facebook.com/v21.0/dialog/oauth?client_id=${appId}&redirect_uri=${redirectUri}&scope=${scope}&response_type=code`;
  }

  async exchangeCodeForToken(code: string) {
    const appId = this.configService.get('META_APP_ID');
    const appSecret = this.configService.get('META_APP_SECRET');
    const redirectUri = this.configService.get('META_REDIRECT_URI');

    const shortUrl = `https://graph.facebook.com/v21.0/oauth/access_token?client_id=${appId}&redirect_uri=${redirectUri}&client_secret=${appSecret}&code=${code}`;

    const responseShort = await lastValueFrom(this.httpService.get(shortUrl));
    const accessTokenShort = responseShort.data.access_token;

    const longUrl = `https://graph.facebook.com/v21.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${appId}&client_secret=${appSecret}&fb_exchange_token=${accessTokenShort}`;

    const responseLong = await lastValueFrom(this.httpService.get(longUrl));

    return responseLong.data;
  }

  async handleFacebookCallback(code: string) {
    const tokenData = await this.exchangeCodeForToken(code);
    
    const expiresAt = new Date();
    expiresAt.setSeconds(expiresAt.getSeconds() + tokenData.expires_in);

    // 3. Salva ou Atualiza no Banco (Upsert)
    // No Nest/Prisma, o upsert evita duplicados: se o ID existe, atualiza; se não, cria.
    return this.prisma.client.upsert({
      where: { facebookUserId: 'user_default' }, // Usaremos um ID fixo por enquanto para teste
      update: {
        fbAccessToken: tokenData.access_token,
        tokenExpiresAt: expiresAt,
      },
      create: {
        name: 'Cliente Principal',
        facebookUserId: 'user_default',
        fbAccessToken: tokenData.access_token,
        tokenExpiresAt: expiresAt,
        // Atenção: Você precisa de um User no banco para o Client existir (Relação)
        user: {
          connectOrCreate: {
            where: { email: 'admin@teste.com' },
            create: { email: 'admin@teste.com', password: '123' }
          }
        }
      },
    });
  }

  async listAdAccounts(clientId: string) {
    // 1. Busca o cliente no banco para pegar o token
    const client = await this.prisma.client.findUnique({
      where: { id: clientId },
    });

    if (!client?.fbAccessToken) throw new Error('Cliente sem token!');

    // 2. Faz a chamada na API da Meta (Marketing API)
    // O endpoint /me/adaccounts traz as contas vinculadas ao token
    const url = `https://graph.facebook.com/v21.0/me/adaccounts?fields=name,currency,id&access_token=${client.fbAccessToken}`;
    
    const response = await lastValueFrom(this.httpService.get(url));
    const accounts = response.data.data;

    // 3. Salva essas contas no banco para uso futuro
    // Usamos o createMany para salvar todas de uma vez
    await this.prisma.adAccount.createMany({
      data: accounts.map(acc => ({
        id: acc.id,           // ID da Meta (ex: act_123)
        name: acc.name,
        clientId: client.id,
      })),
      skipDuplicates: true, // Se a conta já existir, ele pula
    });

    return accounts;
  }

  async getLiveInsights(adAccountId: string, start?: string, end?: string) {
    const adAccount = await this.prisma.adAccount.findUnique({
      where: { id: adAccountId },
      include: { client: true },
    });

    if (!adAccount || !adAccount.client.fbAccessToken) {
      throw new Error('Conta ou Token não encontrados no banco.');
    }

    const fields = 'spend,clicks,reach,frequency,impressions,actions,cpc,ctr,cpm';
    const url = `https://graph.facebook.com/v21.0/${adAccount.id}/insights`;

    const params: any = {
      fields,
      access_token: adAccount.client.fbAccessToken,
    };

    if (start && end) {
      params.time_range = JSON.stringify({ since: start, until: end });
    } else {
      params.date_preset = 'today';
    }

    const response = await lastValueFrom(this.httpService.get(url, { params }));
    const rawData = response.data.data[0];

    if (!rawData) return { message: 'Sem dados para este período.' };

    // Extração inteligente de conversas
    const messagingConversations = rawData.actions?.find(
      (a: any) => a.action_type === 'onsite_conversion.messaging_conversation_started_7d'
    )?.value || 0;

    return {
      accountName: adAccount.name,
      investido: parseFloat(rawData.spend || 0),
      cliques: parseInt(rawData.clicks || 0),
      alcance: parseInt(rawData.reach || 0),
      frequencia: parseFloat(rawData.frequency || 0),
      impressoes: parseInt(rawData.impressions || 0),
      conversas: parseInt(messagingConversations),
      custoPorConversa: messagingConversations > 0 
        ? parseFloat(rawData.spend) / parseInt(messagingConversations) 
        : 0,
      cpc: parseFloat(rawData.cpc || 0),
      ctr: parseFloat(rawData.ctr || 0),
      cpm: parseFloat(rawData.cpm || 0)
    };
  }

  async listAdSets(adAccountId: string) {
    const adAccount = await this.prisma.adAccount.findUnique({
      where: { id: adAccountId },
      include: { client: true },
    });

    // Verificação 1: Existe no nosso banco?
    if (!adAccount || !adAccount.client?.fbAccessToken) {
      throw new NotFoundException('Conta de anúncios ou Token não encontrados.');
    }

    try {
      const url = `https://graph.facebook.com/v21.0/${adAccount.id}/adsets`;
      const response = await lastValueFrom(
        this.httpService.get(url, {
          params: {
            fields: 'id,name,status,daily_budget,lifetime_budget',
            access_token: adAccount.client.fbAccessToken,
          },
        }),
      );

      // Verificação 2: A Meta retornou dados?
      return response.data?.data || [];
    } catch (error) {
      throw new Error(`Erro na API da Meta: ${error.response?.data?.error?.message || error.message}`);
    }
  }

  async listAds(adSetId: string, clientId: string) {
    const client = await this.prisma.client.findUnique({ where: { id: clientId } });

    if (!client?.fbAccessToken) {
      throw new UnauthorizedException('Token do cliente não encontrado.');
    }

    try {
      const url = `https://graph.facebook.com/v21.0/${adSetId}/ads`;
      const response = await lastValueFrom(
        this.httpService.get(url, {
          params: {
            fields: 'id,name,status,creative',
            access_token: client.fbAccessToken,
          },
        }),
      );

      return response.data?.data || [];
    } catch (error) {
      throw new Error(`Erro ao buscar Ads: ${error.message}`);
    }
  }
  
  async getGenericInsights(objectId: string, clientId: string, start?: string, end?: string) {
    // 1. Verificação do Cliente e Token
    const client = await this.prisma.client.findUnique({ where: { id: clientId } });
    
    if (!client) {
      throw new NotFoundException('Cliente não encontrado no sistema.');
    }

    if (!client.fbAccessToken) {
      throw new UnauthorizedException('O cliente selecionado não possui um token do Facebook ativo.');
    }

    const fields = 'spend,clicks,reach,frequency,impressions,actions,cpc,ctr,cpm';
    const url = `https://graph.facebook.com/v21.0/${objectId}/insights`;

    const params: any = {
      fields,
      access_token: client.fbAccessToken,
      time_range: start && end ? JSON.stringify({ since: start, until: end }) : undefined,
      date_preset: !start ? 'today' : undefined,
    };

    try {
      const response = await lastValueFrom(this.httpService.get(url, { params }));
      
      // 2. Verificação da Resposta da Meta
      const rawData = response.data?.data?.[0];

      if (!rawData) {
        return { 
          id: objectId,
          message: 'Sem dados ou atividade para este objeto no período selecionado.',
          investido: 0,
          cliques: 0,
          alcance: 0,
          impressoes: 0,
          conversas: 0
        };
      }

      // 3. Formatação Segura dos Dados
      const messagingConversations = rawData.actions?.find(
        (a: any) => a.action_type === 'onsite_conversion.messaging_conversation_started_7d'
      )?.value || 0;

      return {
        id: objectId,
        investido: parseFloat(rawData.spend || 0),
        cliques: parseInt(rawData.clicks || 0),
        alcance: parseInt(rawData.reach || 0),
        frequencia: parseFloat(rawData.frequency || 0),
        impressoes: parseInt(rawData.impressions || 0),
        conversas: parseInt(messagingConversations),
        cpc: parseFloat(rawData.cpc || 0),
        ctr: parseFloat(rawData.ctr || 0),
        cpm: parseFloat(rawData.cpm || 0)
      };
    } catch (error) {
      // 4. Tratamento de Erro da API (Token expirado, ID inválido, etc)
      const errorMessage = error.response?.data?.error?.message || error.message;
      throw new Error(`Falha na API da Meta para o objeto ${objectId}: ${errorMessage}`);
    }
  }
}