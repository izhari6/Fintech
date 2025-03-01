import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Wallet } from '../../entities/wallet.entity';
import { Repository } from 'typeorm';

@Injectable()
export class WalletRepository extends Repository<Wallet> {
  constructor(
    @InjectRepository(Wallet)
    private readonly walletRepo: Repository<Wallet>,
  ) {
    super(walletRepo.target, walletRepo.manager, walletRepo.queryRunner);
  }

  async findAll(): Promise<Wallet[]> {
    return await this.find();
  }

  async findById(id: number): Promise<Wallet | null> {
    return await this.findOne({ where: { id } });
  }

  async createWallet(wallet: Partial<Wallet>): Promise<Wallet> {
    return await this.save(wallet);
  }

  async updateWallet(id: number, wallet: Partial<Wallet>): Promise<void> {
    await this.update(id, wallet);
  }

  async deleteWallet(id: number): Promise<void> {
    await this.delete(id);
  }
}
