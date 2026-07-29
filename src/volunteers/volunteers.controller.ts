import {
  Controller, Get, Post, Patch, Param, Body,
  UseGuards, BadRequestException, NotFoundException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiCookieAuth, ApiParam } from '@nestjs/swagger';
import { VolunteersService } from './volunteers.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AdminGuard } from '../auth/admin.guard';

@ApiTags('Volunteers')
@Controller('volunteers')
export class VolunteersController {
  constructor(private readonly volunteersService: VolunteersService) {}

  /** Public — submitted from the faith-fighters-site landing page, no account/auth involved. */
  @ApiOperation({ summary: 'Submit a volunteer application from the public landing page' })
  @Post()
  async create(
    @Body() body: { name: string; email: string; phone?: string; cityState: string; availability: string; role: string },
  ) {
    const { name, email, cityState, availability, role } = body;
    if (!name || !email || !cityState || !availability || !role) {
      throw new BadRequestException('name, email, cityState, availability and role are required.');
    }
    const application = await this.volunteersService.create(body);
    return { application };
  }

  @ApiOperation({ summary: 'List all volunteer applications (admin only)' })
  @ApiCookieAuth('fffa_session')
  @Get()
  @UseGuards(JwtAuthGuard, AdminGuard)
  async findAll() {
    const applications = await this.volunteersService.findAll();
    return { applications };
  }

  @ApiOperation({ summary: 'Update a volunteer application status (admin only)' })
  @ApiCookieAuth('fffa_session')
  @ApiParam({ name: 'id', description: 'Volunteer application ID' })
  @Patch(':id/status')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async updateStatus(@Param('id') id: string, @Body() body: { status: string }) {
    if (!body.status) throw new BadRequestException('status is required.');
    const updated = await this.volunteersService.updateStatus(id, body.status);
    if (!updated) throw new NotFoundException('Volunteer application not found.');
    return { application: updated };
  }
}
