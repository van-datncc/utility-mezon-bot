import { Column, Entity, Index, PrimaryGeneratedColumn, Unique } from 'typeorm';
import { TABLE } from '../constants/tables';

@Index(['sicboId', 'userId'])
@Unique(['sicboId', 'userId']) 
@Entity(TABLE.USER_SICBO)
export class UserSicbo {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'text', nullable: true })
  userId: string;

  @Column({ type: 'text', nullable: true })
  sicboId: string;

  @Column({ type: 'decimal', default: null })
  createAt: number;

  @Column({ type: 'numeric', nullable: true, default: 0 })
  sic: number;

  @Column({ type: 'numeric', nullable: true, default: 0 })
  bo: number;
  
  @Column({ type: 'numeric', nullable: true, default: 0 })
  result: number;
}
