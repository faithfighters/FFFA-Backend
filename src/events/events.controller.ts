import {
  Controller, Get, Post, Patch, Delete, Param, Body, Query,
  UseGuards, NotFoundException, BadRequestException,
} from '@nestjs/common';
import { EventsService } from './events.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AdminGuard } from '../auth/admin.guard';
import { ApiTags, ApiOperation, ApiQuery, ApiParam, ApiCookieAuth } from '@nestjs/swagger';

@ApiTags('Events')
@Controller('events')
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  @ApiOperation({ summary: 'List all events, optionally filtered by status' })
  @ApiQuery({ name: 'status', required: false, description: 'Filter by status: upcoming | past' })
  @Get()
  async findAll(@Query('status') status?: string) {
    const filter = status ? { status } : undefined;
    const events = await this.eventsService.findAll(filter);
    return { events };
  }

  @ApiOperation({ summary: 'Get a single event by ID' })
  @ApiParam({ name: 'id', description: 'Event ID' })
  @Get(':id')
  async findOne(@Param('id') id: string) {
    const event = await this.eventsService.findById(id);
    if (!event) throw new NotFoundException('Event not found.');
    return { event };
  }

  @ApiOperation({ summary: 'Create a new event (admin only)' })
  @ApiCookieAuth('fffa_session')
  @Post()
  @UseGuards(JwtAuthGuard, AdminGuard)
  async create(
    @Body() body: {
      title: string;
      description: string;
      date: string;
      startTime: string;
      endTime: string;
      location: string;
      coverImage?: string;
      galleryImages?: string[];
      status?: string;
    },
  ) {
    const { title, description, date, startTime, endTime, location } = body;
    if (!title || !description || !date || !startTime || !endTime || !location) {
      throw new BadRequestException('title, description, date, startTime, endTime and location are required.');
    }
    const event = await this.eventsService.create(body);
    return { event };
  }

  @ApiOperation({ summary: 'Update an event (admin only)' })
  @ApiCookieAuth('fffa_session')
  @ApiParam({ name: 'id', description: 'Event ID' })
  @Patch(':id')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async update(
    @Param('id') id: string,
    @Body() body: Partial<{
      title: string;
      description: string;
      date: string;
      startTime: string;
      endTime: string;
      location: string;
      coverImage: string;
      galleryImages: string[];
      status: string;
    }>,
  ) {
    const event = await this.eventsService.findById(id);
    if (!event) throw new NotFoundException('Event not found.');
    const updated = await this.eventsService.update(id, body as any);
    return { event: updated };
  }

  @ApiOperation({ summary: 'Delete an event (admin only)' })
  @ApiCookieAuth('fffa_session')
  @ApiParam({ name: 'id', description: 'Event ID' })
  @Delete(':id')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async remove(@Param('id') id: string) {
    const event = await this.eventsService.findById(id);
    if (!event) throw new NotFoundException('Event not found.');
    await this.eventsService.delete(id);
    return { success: true };
  }
}
