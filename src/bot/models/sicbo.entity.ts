import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { TABLE } from '../constants/tables';

@Index(['id', 'deleted'])
@Entity(TABLE.SICBO)
export class Sicbo {
  @PrimaryGeneratedColumn()
  id: number;

  @Column('text', { array: true, nullable: true, default: null })
  channelId: string[];

  @Column({ type: 'numeric', nullable: true, default: 0 })
  sic: number;

  @Column({ type: 'numeric', nullable: true, default: 0 })
  bo: number;

  @Column({ type: 'numeric', nullable: true, default: 0 })
  result: number;

  @Column({ nullable: true, default: false })
  deleted: boolean;

  @Column({ type: 'bigint', default: null })
  createAt: number;

  @Column({ type: 'bigint', default: null })
  endAt: number;
}
