import { Kafka, logLevel, SASLOptions } from 'kafkajs';

export function createKafkaClient(clientId: string): Kafka {
  const brokers = (process.env.KAFKA_BROKERS || 'localhost:9094').split(',');
  const useSsl = process.env.KAFKA_SSL === 'true';
  const username = process.env.KAFKA_SASL_USERNAME;
  const password = process.env.KAFKA_SASL_PASSWORD;
  const mechanism = (process.env.KAFKA_SASL_MECHANISM as any) || 'scram-sha-256';

  let sasl: SASLOptions | undefined = undefined;
  if (username && password) {
    sasl = {
      mechanism,
      username,
      password
    };
  }

  return new Kafka({
    clientId,
    brokers,
    ssl: useSsl || !!sasl,
    sasl,
    logLevel: logLevel.NOTHING,
    connectionTimeout: 2000,
    requestTimeout: 3000,
    retry: {
      initialRetryTime: 100,
      retries: 1
    }
  });
}
