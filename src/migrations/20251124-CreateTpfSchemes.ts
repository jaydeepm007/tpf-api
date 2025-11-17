import { MigrationInterface, QueryRunner, Table } from 'typeorm';

export class CreateTpfSchemes20251124000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'tpf_schemes',
        columns: [
          {
            name: 'id',
            type: 'serial',
            isPrimary: true,
          },
          {
            name: 'pfm_id',
            type: 'varchar',
            length: '255',
            isNullable: false,
          },
          {
            name: 'scheme_code',
            type: 'varchar',
            length: '255',
            isNullable: false,
          },
          {
            name: 'scheme_name',
            type: 'varchar',
            length: '255',
            isNullable: false,
          },
          {
            name: 'asset_category',
            type: 'varchar',
            length: '255',
            isNullable: false
          },
          {
            name: 'contribution_type',
            type: 'varchar',
            length: '255',
            isNullable: false
          },
          {
            name: 'nav',
            type: 'numeric',
            isNullable: false,
            precision: 15,
            scale: 4
          },
          {
            name: 'nav_date',
            type: 'timestamp with time zone',
            isNullable: false
          },
          {
            name: 'create_date',
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
    await queryRunner.dropTable('tpf_schemes');
  }
}
