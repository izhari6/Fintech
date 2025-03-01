import { Injectable } from '@nestjs/common';
import { Transaction } from '../../entities/transaction.entity';
import { RabbitMQService } from '../RabbitMQ/rabbitmq.service';
import { TransactionRepository } from './transaction.repository';
import { TransactionStatus } from '../../common/enums/transaction-status.enum';
import { Exchanges } from '../RabbitMQ/enums/exchanges.enum';
import { RoutingKeys } from '../RabbitMQ/enums/routing-keys.enums';
import { WalletService } from '../wallet/wallet.service';
import { In, Not } from 'typeorm';

@Injectable()
export class TransactionService {
  constructor(
    private readonly rabbitMQService: RabbitMQService,
    private transactionRepository: TransactionRepository,
    private walletService: WalletService,
  ) {}

  async createTransaction(
    walletId: number,
    amount: number,
  ): Promise<Transaction | null> {
    // Fetch the wallet by its ID
    const wallet = await this.walletService.getWalletById(walletId);

    if (!wallet) {
      console.error(`Wallet not found - wallet id ${walletId}`);
      return null;
    }

    // שמירת הטרנזקציה ב-DB
    const transaction = await this.transactionRepository.createTransaction({
      wallet,
      amount,
      status: TransactionStatus.WAITING_FOR_WORKER,
    });

    await this.transactionRepository.save(transaction);

    try {
      await this.rabbitMQService.publish(
        Exchanges.PAYMENT,
        RoutingKeys.PAYMENT_REQUEST,
        transaction,
      );
    } catch (error) {
      console.error(
        `Failed to send transaction ${transaction.id} to RabbitMQ`,
        error,
      );
      console.error('Failed to send transaction to RabbitMQ');
    }

    return transaction;
  }

  /**
   * עדכון סטטוס של טרנזקציה במסד הנתונים
   */
  async updateTransactionStatus(
    transactionId: number,
    status: TransactionStatus,
  ): Promise<void> {
    await this.transactionRepository.update(transactionId, { status });
  }

  async getTransactionStatus(
    transactionId: number,
  ): Promise<TransactionStatus> {
    const transaction = await this.transactionRepository.findOne({
      where: { id: transactionId },
    });
    if (!transaction) {
      console.error('Transaction not found');
    }
    return transaction!.status;
  }

  async retryTransaction(
    transaction: Transaction,
    transactionStatus:
      | TransactionStatus.RETRYING
      | TransactionStatus.RETRYING_INSUFFICIANT_BALANCE,
  ): Promise<Transaction> {
    await this.updateTransactionStatus(transaction.id, transactionStatus);

    // שליחה מחדש לתור RabbitMQ
    await this.rabbitMQService.publish(
      Exchanges.PAYMENT,
      RoutingKeys.PAYMENT_RETRY,
      transaction,
    );

    return transaction;
  }

  /**
   * סימולציה של אישור טרנזקציה עם השהיה רנדומלית
   */
  async processTransaction(transaction: Transaction): Promise<void> {
    console.log(`🔵 Processing transaction ${transaction.id}`);

    const wallet = await this.walletService.getWalletById(
      transaction.wallet.id,
    );

    if (!wallet) {
      console.error(`Wallet ${transaction.wallet.id} not found`);
      await this.retryTransaction(transaction, TransactionStatus.RETRYING);
      return;
    }

    await this.walletService.updateWallet(wallet.id, wallet);

    await this.updateTransactionStatus(
      transaction.id,
      TransactionStatus.DELAYED_PROCESSING,
    );

    // סימולציה של השהיית אישור (2-7 שניות)
    const delay = Math.floor(Math.random() * 5000) + 2000;
    console.log(`Transaction ${transaction.id} delyed by ${delay} ms`);
    await new Promise((resolve) => setTimeout(resolve, delay));

    await this.updateTransactionStatus(
      transaction.id,
      TransactionStatus.PROCESSING,
    );

    if (wallet.balance - wallet.reserved < transaction.amount) {
      console.error(
        `🔴Insufficient balance: Wallet-${wallet.id}, 
        Amount-${transaction.amount}, Balance (Minus reserved)-${wallet.balance - wallet.reserved}.
        Transaction will move to retry queue.`,
      );
      await this.retryTransaction(
        transaction,
        TransactionStatus.RETRYING_INSUFFICIANT_BALANCE,
      );
      throw new Error(`🔴Insufficient balance: Wallet-${wallet.id}, 
        Amount-${transaction.amount}, Balance (Minus reserved)-${wallet.balance - wallet.reserved}.
        Transaction will move to retry queue.`);
    }

    wallet.reserved += transaction.amount;

    // 80% הצלחה, 20% כישלון
    const success = Math.random() > 0.2;

    if (success) {
      console.log(`Transaction ${transaction.id} success`);
      wallet.balance -= wallet.reserved;
      wallet.reserved -= transaction.amount;
      this.walletService.updateWallet(wallet.id, wallet);
      await this.updateTransactionStatus(
        transaction.id,
        TransactionStatus.APPROVED,
      );

      console.log(`✅ Transaction ${transaction.id} completed`);
    } else {
      console.log(
        `⚠️ Transaction ${transaction.id} failed, sending to retry queue`,
      );
      wallet.reserved -= transaction.amount;
      this.walletService.updateWallet(wallet.id, wallet);
      await this.retryTransaction(transaction, TransactionStatus.RETRYING);
    }
  }

  async getDeadLetterQueue(): Promise<Transaction[]> {
    const dlqTransactions = await this.transactionRepository.find({
      where: { status: TransactionStatus.SENT_TO_DEAD_LETTER_QUEUE },
    });
    return dlqTransactions;
  }

  async getWalletTransactions(walletId: number): Promise<Transaction[]> {
    const transactions = await this.transactionRepository.find({
      where: { wallet: { id: walletId } },
    });
    return transactions;
  }

  async getWalletProccesingTransactions(walletId: number): Promise<number> {
    const transactionsCount = await this.transactionRepository.count({
      where: {
        wallet: { id: walletId },
        status: In([
          TransactionStatus.PROCESSING,
          TransactionStatus.DELAYED_PROCESSING,
        ]),
      },
    });
    return transactionsCount;
  }

  async getOldestPendingTransaction(
    walletId: number,
    transactionId: number,
  ): Promise<Transaction | null> {
    return this.transactionRepository.findOne({
      where: {
        wallet: { id: walletId },
        status: In([
          TransactionStatus.PROCESSING,
          TransactionStatus.DELAYED_PROCESSING,
          TransactionStatus.WAITING_FOR_WORKER,
        ]),
        id: Not(transactionId),
      },
      relations: ['wallet'],
      order: {
        createdAt: 'ASC',
      },
    });
  }

  async updateTransaction(
    transactionId: number,
    transaction: Partial<Transaction>,
  ): Promise<void> {
    await this.transactionRepository.update({ id: transactionId }, transaction);
  }
}
