import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { TABLE } from '../constants/tables';

@Index(['id', 'transactionId'])
@Entity(TABLE.TRANSACTION)
export class Transaction {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'text', nullable: true })
  transactionId: string;

  @Column({ type: 'text', nullable: true, default: null })
  note: string;

  @Column({ type: 'numeric', nullable: true, default: 0 })
  amount: number;

  @Column({ type: 'text', nullable: true })
  sender_id: string;

  @Column({ type: 'text', nullable: true })
  receiver_id: string;
  
  @Column({ type: 'bigint', default: null })
  createAt: number;
}
