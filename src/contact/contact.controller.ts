import {
  Controller, Get, Post, Patch, Param, Body,
  UseGuards, BadRequestException, NotFoundException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiCookieAuth, ApiParam } from '@nestjs/swagger';
import { ContactService } from './contact.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AdminGuard } from '../auth/admin.guard';

@ApiTags('Contact')
@Controller('contact')
export class ContactController {
  constructor(private readonly contactService: ContactService) {}

  /** Public — submitted from the faith-fighters-site landing page, no account/auth involved. */
  @ApiOperation({ summary: 'Submit a contact message from the public landing page' })
  @Post()
  async create(
    @Body() body: { name: string; email: string; subject?: string; message: string },
  ) {
    const { name, email, message } = body;
    if (!name || !email || !message) {
      throw new BadRequestException('name, email and message are required.');
    }
    const contactMessage = await this.contactService.create(body);
    return { contactMessage };
  }

  @ApiOperation({ summary: 'List all contact messages (admin only)' })
  @ApiCookieAuth('fffa_session')
  @Get()
  @UseGuards(JwtAuthGuard, AdminGuard)
  async findAll() {
    const messages = await this.contactService.findAll();
    return { messages };
  }

  @ApiOperation({ summary: 'Update a contact message status (admin only)' })
  @ApiCookieAuth('fffa_session')
  @ApiParam({ name: 'id', description: 'Contact message ID' })
  @Patch(':id/status')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async updateStatus(@Param('id') id: string, @Body() body: { status: string }) {
    if (!body.status) throw new BadRequestException('status is required.');
    const updated = await this.contactService.updateStatus(id, body.status);
    if (!updated) throw new NotFoundException('Contact message not found.');
    return { contactMessage: updated };
  }
}
