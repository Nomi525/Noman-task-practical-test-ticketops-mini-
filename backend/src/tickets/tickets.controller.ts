import {
  Controller,
  Post,
  Get,
  Patch,
  Param,
  Body,
  Query,
  Headers,
  UseGuards,
  Req,
  ParseUUIDPipe,
} from '@nestjs/common';
import { TicketsService } from './tickets.service';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { ListTicketsDto } from './dto/list-tickets.dto';
import { UpdateStatusDto } from './dto/update-status.dto';
import { ActorGuard } from '../common/guards/actor.guard';

@Controller('tickets')
export class TicketsController {
  constructor(private readonly ticketsService: TicketsService) {}

  // POST /tickets
  @Post()
  @UseGuards(ActorGuard)
  async create(
    @Body() dto: CreateTicketDto,
    @Req() req: any,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    const { ticket, idempotent } = await this.ticketsService.create(
      dto,
      req.actor,
      req.role,
      idempotencyKey,
    );
    return {
      data: ticket,
      meta: { idempotent },
    };
  }

  // GET /tickets
  @Get()
  async findAll(@Query() query: ListTicketsDto) {
    return this.ticketsService.findAll(query);
  }

  // GET /tickets/:id
  @Get(':id')
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    const ticket = await this.ticketsService.findOne(id);
    return { data: ticket };
  }

  // PATCH /tickets/:id/status
  @Patch(':id/status')
  @UseGuards(ActorGuard)
  async updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateStatusDto,
    @Req() req: any,
  ) {
    const ticket = await this.ticketsService.updateStatus(id, dto, req.actor);
    return { data: ticket };
  }
}
