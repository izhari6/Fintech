import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TransactionService } from './transaction.service';
import { TransactionController } from './transaction.controller';
import { Transaction } from '../../entities/transaction.entity';
import { RabbitMQService } from '../RabbitMQ/rabbitmq.service';
import { TransactionRepository } from './transaction.repository';
import { WalletModule } from '../wallet/wallet.module';
import { TransactionWorker } from './workers/transaction.worker';

@Module({
  imports: [TypeOrmModule.forFeature([Transaction]), WalletModule],
  providers: [
    TransactionService,
    RabbitMQService,
    TransactionRepository,
    TransactionWorker,
  ],
  controllers: [TransactionController],
})
export class TransactionModule {}
