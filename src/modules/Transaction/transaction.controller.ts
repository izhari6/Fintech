import { Controller, Post, Get, Param, Body } from '@nestjs/common';
import { TransactionService } from './transaction.service';
import { TransactionCreateDto } from './dtos/transaction-create.dto';

@Controller('transactions')
export class TransactionController {
  constructor(private readonly transactionService: TransactionService) {}

  // יצירת טרנזקציה חדשה
  @Post()
  async createTransaction(
    @Body()
    createTransactionDto: TransactionCreateDto,
  ) {
    return this.transactionService.createTransaction(
      createTransactionDto.walletId,
      createTransactionDto.amount,
    );
  }

  // קבלת סטטוס של טרנזקציה לפי ID
  @Get(':id/status')
  async getTransactionStatus(@Param('id') transactionId: number) {
    return this.transactionService.getTransactionStatus(transactionId);
  }

  // ניסיון נוסף לביצוע טרנזקציה שנכשלה
  // @Post(':id/retry')
  // async retryTransaction(@Param('id') transactionId: number) {
  //   return this.transactionService.retryTransaction(transactionId);
  // }

  // ביצוע עיבוד של טרנזקציה עם דיליי רנדומלי
  // @Post(':id/process')
  // async processTransactionWithDelay(@Param('id') transactionId: number) {
  //   return this.transactionService.processTransaction(transactionId);
  // }

  // שליפת כל הטרנזקציות של ארנק מסוים
  @Get('wallet/:walletId')
  async getWalletTransactions(@Param('walletId') walletId: number) {
    return this.transactionService.getWalletTransactions(walletId);
  }

  // שליפת כל הטרנזקציות שנכשלו (DLQ)
  @Get('dead-letter')
  async getDeadLetterQueue() {
    return this.transactionService.getDeadLetterQueue();
  }
}
