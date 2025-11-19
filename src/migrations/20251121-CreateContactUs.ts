import { MigrationInterface, QueryRunner, Table } from 'typeorm';

export class CreateContactUs20251121000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'tpf_contact_us',
        columns: [
          {
            name: 'id',
            type: 'serial',
            isPrimary: true,
          },
          {
            name: 'full_name',
            type: 'varchar',
            length: '255',
            isNullable: false,
          },
          {
            name: 'email',
            type: 'varchar',
            length: '255',
            isNullable: false
          },
          {
            name: 'phone',
            type: 'varchar',
            length: '50',
            isNullable: false
          },
          {
            name: 'note',
            type: 'text',
            isNullable: false,
          },
          {
            name: 'created_date',
            type: 'timestamp with time zone',
            default: 'now()',
            isNullable: false,
          }
        ],
      }),
      true,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('tpf_contact_us');
  }
}
