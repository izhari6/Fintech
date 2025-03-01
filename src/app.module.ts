import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Transaction } from './entities/transaction.entity';
import { TransactionModule } from './modules/Transaction/transaction.module';
import { RabbitMQService } from './modules/RabbitMQ/rabbitmq.service';
import { WalletModule } from './modules/wallet/wallet.module';
import { Wallet } from './entities/wallet.entity';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres', // סוג מסד הנתונים
      host: 'localhost',
      port: 5432,
      username: 'postgres',
      password: 'Aa123456',
      database: 'BlockChainDB',
      entities: [Transaction, Wallet], // הישות שמייצגת את טבלת הטרנזקציות
      synchronize: true, // ייצור טבלאות באופן אוטומטי (לא בסביבה ייצור)
    }),
    TypeOrmModule.forFeature([Transaction, Wallet]),
    TransactionModule,
    WalletModule,
  ],
  providers: [RabbitMQService],
})
export class AppModule {}
