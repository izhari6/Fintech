import { Entity, PrimaryGeneratedColumn, Column, ManyToOne } from 'typeorm';
import { Wallet } from './wallet.entity';
import { TransactionStatus } from '../common/enums/transaction-status.enum';

@Entity()
export class Transaction {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Wallet, (wallet) => wallet.transactions)
  wallet: Wallet;

  @Column()
  amount: number;

  @Column()
  status: TransactionStatus; // ניתן להוסיף Enum עבור סטטוסים

  @Column({ default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;

  @Column({
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP',
    onUpdate: 'CURRENT_TIMESTAMP',
  })
  updatedAt: Date;

  @Column({ nullable: true })
  lastAttemptAt: Date;

  @Column({ nullable: true })
  rabbitMessege: string;
}
