import {
  Controller, Get, Patch, Param, Body, Req,
  UseGuards, BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiCookieAuth, ApiParam } from '@nestjs/swagger';
import { SiteContentService } from './site-content.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AdminGuard } from '../auth/admin.guard';

@ApiTags('Site Content')
@Controller('site-content')
export class SiteContentController {
  constructor(private readonly siteContentService: SiteContentService) {}

  @ApiOperation({ summary: 'List every editable page and its last-saved info (admin only)' })
  @ApiCookieAuth('fffa_session')
  @Get()
  @UseGuards(JwtAuthGuard, AdminGuard)
  async listPages() {
    const pages = await this.siteContentService.listPages();
    return { pages };
  }

  @ApiOperation({ summary: 'Get the field schema for a page (admin only — drives the edit form)' })
  @ApiCookieAuth('fffa_session')
  @ApiParam({ name: 'page', description: 'Page slug, e.g. "home"' })
  @Get(':page/manifest')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async getManifest(@Param('page') page: string) {
    const manifest = this.siteContentService.getManifest(page);
    return { manifest };
  }

  @ApiOperation({ summary: 'Get a page\'s saved content overrides (public — read by both the site and the admin editor)' })
  @ApiParam({ name: 'page', description: 'Page slug, e.g. "home"' })
  @Get(':page')
  async getContent(@Param('page') page: string) {
    const content = await this.siteContentService.getContent(page);
    return { content };
  }

  @ApiOperation({ summary: 'Save a page\'s content overrides (admin only)' })
  @ApiCookieAuth('fffa_session')
  @ApiParam({ name: 'page', description: 'Page slug, e.g. "home"' })
  @Patch(':page')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async replaceContent(@Param('page') page: string, @Body() body: { content?: Record<string, any> }, @Req() req: any) {
    if (!body.content || typeof body.content !== 'object') {
      throw new BadRequestException('content is required.');
    }
    const updated = await this.siteContentService.replaceContent(page, body.content, req.user.userId);
    return { content: updated.content };
  }
}
