import { Injectable, OnModuleDestroy } from '@nestjs/common';
import * as amqp from 'amqp-connection-manager';
import { ConsumeMessage } from 'amqplib';
import { Exchanges } from './enums/exchanges.enum';
import { Queues } from './enums/queues.enums';
import { RoutingKeys } from './enums/routing-keys.enums';

@Injectable()
export class RabbitMQService implements OnModuleDestroy {
  private connection = amqp.connect(['amqp://localhost']);
  private channelWrapper = this.connection.createChannel({
    json: true,
    setup: (channel: amqp.Channel) =>
      Promise.all([
        // Create exchange for transaction process
        channel.assertExchange(Exchanges.PAYMENT, 'direct', { durable: true }),

        // Create exchange for Dead Letter Queue
        channel.assertExchange(Exchanges.PAYMENT_DEAD_LETTER, 'direct', {
          durable: true,
        }),

        // Create Queue for transactions
        channel.assertQueue(Queues.PAYMENT, {
          durable: true,
          deadLetterExchange: Exchanges.PAYMENT_DEAD_LETTER,
          deadLetterRoutingKey: RoutingKeys.PAYMENT_DLQ,
        }),

        // Create Queue for Retry Queue
        channel.assertQueue(Queues.PAYMENT_RETRY, {
          deadLetterExchange: Exchanges.PAYMENT_DEAD_LETTER,
          deadLetterRoutingKey: RoutingKeys.PAYMENT_DLQ,
          messageTtl: 5000,
          maxPriority: 10,
        }),

        // Create Dead Letter Queue
        channel.assertQueue(Queues.PAYMENT_DEAD_LETTER, { durable: true }),

        // Bindings - connecting queues to exchanges
        channel.bindQueue(
          Queues.PAYMENT,
          Exchanges.PAYMENT,
          RoutingKeys.PAYMENT_REQUEST,
        ),
        channel.bindQueue(
          Queues.PAYMENT_RETRY,
          Exchanges.PAYMENT,
          RoutingKeys.PAYMENT_RETRY,
        ),
        channel.bindQueue(
          Queues.PAYMENT_DEAD_LETTER,
          Exchanges.PAYMENT_DEAD_LETTER,
          RoutingKeys.PAYMENT_DLQ,
        ),
      ]),
  });

  // Send to RabbitMQ
  async publish(exchange: Exchanges, routingKey: RoutingKeys, message: any) {
    await this.channelWrapper.publish(
      exchange,
      routingKey,
      JSON.stringify(message),
      { persistent: true },
    );
  }

  // Consume from RabbitMQ
  async consume(queue: Queues, onMessage: (msg: ConsumeMessage) => void) {
    await this.channelWrapper.addSetup((channel: amqp.Channel) => {
      return channel.consume(queue, onMessage);
    });
  }

  onModuleDestroy() {
    this.connection.close();
  }

  // Acknowledge message
  ack(message: ConsumeMessage) {
    this.channelWrapper.ack(message);
  }

  // Send message back to queue in case of failure or retry
  async nack(message: ConsumeMessage, requeue: boolean) {
    if (requeue) {
      // Resend to retry queue if retry is needed
      this.channelWrapper.nack(message, false, true); // Requeue = true
      console.log(`Message requeued: ${message.content.toString()}`);
    } else {
      // If not resending, send the message to Dead Letter Queue (DLQ)
      this.publish(
        Exchanges.PAYMENT_DEAD_LETTER,
        RoutingKeys.PAYMENT_DLQ,
        Buffer.from(message.content.toString()), // Send the message to DLQ
      );
      this.channelWrapper.nack(message, false, false); // Do not requeue
      console.log(`Message sent to DLQ: ${message.content.toString()}`);
    }
  }

  // Access to channel
  getChannel() {
    return this.channelWrapper;
  }

  // Access to connection
  getConnection() {
    return this.connection;
  }
}
