import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('idempotency_keys')
export class IdempotencyKey {
  @PrimaryColumn({ type: 'varchar', length: 500 })
  key: string;

  @Column({ type: 'varchar', length: 64 })
  requestHash: string;

  @Column({ type: 'varchar', length: 36 })
  responseRef: string; // ticket id

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
