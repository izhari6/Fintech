import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { TransactionService } from './modules/Transaction/transaction.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const transactionService = app.get(TransactionService);

  try {
    // Create multiple transactions
    const transactions = [
      { walletId: 123, amount: 50 },
      { walletId: 123, amount: 50 },
      { walletId: 123, amount: 50 },
      { walletId: 123, amount: 50 },
      { walletId: 123, amount: 50 },
      { walletId: 112, amount: 100 },
    ];

    for (const transaction of transactions) {
      const newTransaction = await transactionService.createTransaction(
        transaction.walletId,
        transaction.amount,
      );
      console.log('Transaction Created:', newTransaction);

      if (!newTransaction || !newTransaction.id) {
        console.error('Failed to create transaction');
      }
    }

    console.log('Listening on port 3000');
    await app.listen(3000);
  } catch (error) {
    console.error('Error:', error.message);
  }
}

bootstrap();
