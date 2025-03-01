import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Transaction } from '../../entities/transaction.entity';
import { Repository } from 'typeorm';

@Injectable()
export class TransactionRepository extends Repository<Transaction> {
  constructor(
    @InjectRepository(Transaction)
    private readonly transactionRepo: Repository<Transaction>,
  ) {
    super(
      transactionRepo.target,
      transactionRepo.manager,
      transactionRepo.queryRunner,
    );
  }

  async findAll(): Promise<Transaction[]> {
    return await this.find();
  }

  async findById(id: number): Promise<Transaction | null> {
    return await this.findOne({ where: { id } });
  }

  async createTransaction(
    transaction: Partial<Transaction>,
  ): Promise<Transaction> {
    return await this.save(transaction);
  }

  async updateTransaction(
    id: number,
    transaction: Partial<Transaction>,
  ): Promise<void> {
    await this.update(id, transaction);
  }

  async deleteTransaction(id: number): Promise<void> {
    await this.delete(id);
  }
}
