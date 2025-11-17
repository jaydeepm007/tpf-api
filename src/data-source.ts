import 'reflect-metadata';
import { DataSource } from 'typeorm';
import dotenv from 'dotenv';
dotenv.config();

const host = process.env.PGHOST ?? process.env.DB_HOST ?? 'localhost';
const port = parseInt(process.env.PGPORT ?? process.env.DB_PORT ?? '5432', 10);
const username = process.env.PGUSER ?? process.env.DB_USER ?? 'postgres';
const password = process.env.PGPASSWORD ?? process.env.DB_PASS ?? 'postgres';
const database = process.env.PGDATABASE ?? process.env.DB_NAME ?? 'tpf';

console.info(`TypeORM DataSource using host=${host} port=${port} user=${username} database=${database}`);

const AppDataSource = new DataSource({
  type: 'postgres',
  host,
  port,
  username,
  password,
  database,
  synchronize: false,
  logging: false,
  entities: [__dirname + '/entities/*.ts'],
  migrations: [__dirname + '/migrations/*.ts'],
});

export default AppDataSource;
export { AppDataSource };
