import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { Transaction } from '../../../entities/transaction.entity';
import { RabbitMQService } from '../../RabbitMQ/rabbitmq.service';
import { TransactionService } from '../transaction.service';
import { Queues } from '../../RabbitMQ/enums/queues.enums';
import { ConsumeMessage } from 'amqplib';
import { TransactionStatus } from '../../../common/enums/transaction-status.enum';
import { Cron } from '@nestjs/schedule';
import { WalletService } from '../../../modules/wallet/wallet.service';

@Injectable()
export class TransactionWorker implements OnModuleInit, OnModuleDestroy {
  private readonly maxRetries = 3; // Maximum number of retries

  constructor(
    private readonly rabbitMQService: RabbitMQService,
    private readonly transactionService: TransactionService,
    private readonly walletService: WalletService,
  ) {}

  async onModuleInit() {
    console.log('✅ Transaction Worker Initialized');

    // Listening to new transactions in the main queue
    await this.rabbitMQService.consume(
      Queues.PAYMENT,
      this.consumePayment.bind(this),
    );

    await this.rabbitMQService.consume(
      Queues.PAYMENT_RETRY,
      this.consumeRetry.bind(this),
    );
  }

  async consumeRetry(msg: ConsumeMessage) {
    this.consumePayment(msg);
  }

  async consumePayment(msg: ConsumeMessage) {
    if (msg) {
      const transaction = JSON.parse(
        JSON.parse(Buffer.from(msg.content).toString()),
      ) as Transaction;

      const retryCount =
        (msg.properties.headers?.['x-retry-count'] as number) || 0;

      console.log(
        `Processing transaction: ${transaction.id}, Retry count: ${retryCount}`,
      );

      try {
        const transactionsCount =
          await this.transactionService.getWalletProccesingTransactions(
            transaction.wallet.id,
          );
        if (!transactionsCount) {
          // If we successfully processed the transaction
          await this.transactionService.processTransaction(transaction);
          // Acknowledge the message after successful processing
          this.rabbitMQService.ack(msg);
          if (transaction.rabbitMessege) {
            this.transactionService.updateTransaction(transaction.id, {
              ...transaction,
              rabbitMessege: undefined,
            });
          }
          console.log(`Transaction ${transaction.id} acked!`);
          const oldestTransaction =
            await this.transactionService.getOldestPendingTransaction(
              transaction.wallet.id,
              transaction.id,
            );
          if (oldestTransaction?.rabbitMessege) {
            const oldestTransactionMsg = JSON.parse(
              oldestTransaction.rabbitMessege,
            ) as ConsumeMessage;
            this.consumePayment(oldestTransactionMsg);
          }
        } else {
          this.transactionService.updateTransaction(transaction.id, {
            ...transaction,
            rabbitMessege: JSON.stringify(msg),
          });
        }
      } catch (error) {
        console.error(`Error processing transaction: ${transaction.id}`, error);

        this.transactionService.updateTransactionStatus(
          transaction.id,
          TransactionStatus.RETRYING,
        );

        if (retryCount < this.maxRetries) {
          // If we haven't exceeded the retry limit, perform a retry
          msg.properties.headers = {
            ...msg.properties.headers,
            'x-retry-count': retryCount + 1,
          };
          await this.rabbitMQService.nack(msg, true); // Re-send with updated retry count header
        } else {
          this.transactionService.updateTransactionStatus(
            transaction.id,
            TransactionStatus.SENT_TO_DEAD_LETTER_QUEUE,
          );

          // Free reserved money
          this.walletService.updateWallet(transaction.wallet.id, {
            ...transaction.wallet,
            reserved: transaction.wallet.reserved - transaction.amount,
          });

          msg.properties.headers = {
            ...msg.properties.headers,
            'x-retry-count': retryCount,
          };
          // If we exceeded the maximum number of retries, send to DLQ
          await this.rabbitMQService.nack(msg, false);
        }
      }
    }
  }

  @Cron('0 */5 * * * *')
  async consumeDLQCron() {
    console.log('Consuming messages from DLQ every 5 minutes');
    await this.rabbitMQService.consume(
      Queues.PAYMENT_DEAD_LETTER,
      this.consumeDLQ.bind(this),
    );
  }
  async consumeDLQ(msg: ConsumeMessage) {
    if (msg) {
      const transaction = JSON.parse(
        Buffer.from(msg.content).toString(),
      ) as Transaction;

      console.error(
        `Transaction ${transaction.id} moved to Dead Letter Queue due to failure`,
      );

      const wallet = await this.walletService.getWalletById(
        transaction.wallet.id,
      );

      if (!wallet) {
        console.error(`Wallet ${transaction.wallet.id} not found`);
        await this.transactionService.retryTransaction(
          transaction,
          TransactionStatus.RETRYING,
        );
        return;
      }

      if (wallet.balance - wallet.reserved < transaction.amount) {
        console.error(
          `🔴Insufficient balance: Wallet-${wallet.id}, 
        Amount-${transaction.amount}, Balance (Minus reserved)-${wallet.balance - wallet.reserved}.
        Transaction will move to retry queue.`,
        );
        await this.transactionService.updateTransactionStatus(
          transaction.id,
          TransactionStatus.RETRYING_INSUFFICIANT_BALANCE,
        );
        await this.transactionService.retryTransaction(
          transaction,
          TransactionStatus.RETRYING_INSUFFICIANT_BALANCE,
        );
        return;
      }

      // Free reserved money
      this.walletService.updateWallet(transaction.wallet.id, {
        ...transaction.wallet,
        reserved: transaction.wallet.reserved + transaction.amount,
      });

      // You can add retry logic or re-send to the main queue here
      try {
        await this.transactionService.retryTransaction(
          transaction,
          TransactionStatus.RETRYING,
        );
        this.rabbitMQService.ack(msg);
      } catch (error) {
        console.error(`Failed to retry transaction ${transaction.id}`, error);
      }
    }
  }

  async onModuleDestroy() {
    console.log('Transaction Worker Stopped');
  }
}
