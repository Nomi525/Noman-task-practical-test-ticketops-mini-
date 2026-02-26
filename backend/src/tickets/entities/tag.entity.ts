import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToMany,
  Index,
} from 'typeorm';
import { Ticket } from './ticket.entity';

@Entity('tags')
export class Tag {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('idx_tags_name', { unique: true })
  @Column({ type: 'varchar', length: 100, unique: true })
  name: string;

  @ManyToMany(() => Ticket, (ticket) => ticket.tags)
  tickets: Ticket[];
}
