import { IsNotEmpty, IsNumber } from 'class-validator';

export class TransactionCreateDto {
  @IsNotEmpty()
  @IsNumber()
  readonly walletId: number;

  @IsNotEmpty()
  @IsNumber()
  readonly amount: number;
}
