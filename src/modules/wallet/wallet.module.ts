import { Module } from '@nestjs/common';
import { WalletRepository } from './wallet.repository';
import { WalletService } from './wallet.service';
import { Wallet } from '../../entities/wallet.entity';
import { TypeOrmModule } from '@nestjs/typeorm';

@Module({
  imports: [TypeOrmModule.forFeature([Wallet])],
  providers: [WalletService, WalletRepository],
  exports: [WalletService, WalletRepository], // Add this line to export the providers
})
export class WalletModule {}
