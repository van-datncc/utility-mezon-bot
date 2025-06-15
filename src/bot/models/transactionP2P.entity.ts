import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { TABLE } from '../constants/tables';

@Index(['id', 'clanId'])
@Entity(TABLE.TRANSACTION_P2P)
export class TransactionP2P {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'text', nullable: true })
  clanId: string;

  @Column({ type: 'text', nullable: true })
  sellerId: string;

  @Column({ type: 'text', nullable: true })
  buyerId: string;

  @Column({ type: 'text', nullable: true })
  buyerName: string;

  @Column({ type: 'jsonb', nullable: true, default: {} })
  amountLock:
    | {
        username: string;
        amount: number;
      }
    | Record<string, never>;

  @Column({ type: 'text', nullable: true, default: null })
  note: string;

  @Column({ type: 'numeric', nullable: true, default: 0 })
  amount: number;

  @Column({ type: 'text', nullable: true, default: null })
  tknh: string;

  @Column({ type: 'text', nullable: true, default: null })
  stk: string;

  @Column({ nullable: true, default: false })
  deleted: boolean;

  @Column({ nullable: true, default: false })
  status: boolean;

  @Column({ nullable: true, default: false })
  pendingBuyerConfirmation: boolean;

  @Column({ nullable: true, default: false })
  pendingSellerConfirmation: boolean;

  @Column({ type: 'jsonb', nullable: true, default: [] })
  message: {
    id: string;
    clan_id: string;
    channel_id: string;
    content: {}[];
  }[];
}
