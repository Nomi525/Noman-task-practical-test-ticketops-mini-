import { IsEnum, IsNotEmpty } from 'class-validator';
import { TicketStatus } from '../entities/ticket.entity';

export class UpdateStatusDto {
  @IsNotEmpty()
  @IsEnum(TicketStatus, {
    message: `status must be one of: ${Object.values(TicketStatus).join(', ')}`,
  })
  status: TicketStatus;
}
