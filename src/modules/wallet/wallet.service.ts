import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Wallet } from '../../entities/wallet.entity';
import { Repository } from 'typeorm';
import * as semaphore from 'semaphore';

@Injectable()
export class WalletService {
  private readonly walletSemaphores: Map<number, semaphore.Semaphore> =
    new Map();

  constructor(
    @InjectRepository(Wallet)
    private readonly walletRepository: Repository<Wallet>,
  ) {}

  // Create a wallet for a user
  async createWallet(name: string): Promise<Wallet> {
    const wallet = this.walletRepository.create({ name });
    return await this.walletRepository.save(wallet);
  }

  async getWalletById(id: number): Promise<Wallet | null> {
    return this.walletRepository.findOneBy({ id });
  }

  async updateWallet(
    walletId: number,
    updatedWallet: Partial<Wallet>,
  ): Promise<void> {
    this.walletRepository.update({ id: walletId }, updatedWallet);
  }

  public getWalletSemaphore(walletId: number): semaphore.Semaphore {
    if (!this.walletSemaphores.has(walletId)) {
      const semaphoreInstance = semaphore(1); // מאחסן Semaphore אחד לארנק, מאפשר טרנזקציה אחת בכל פעם
      this.walletSemaphores.set(walletId, semaphoreInstance);
    }

    return this.walletSemaphores.get(walletId);
  }
}
