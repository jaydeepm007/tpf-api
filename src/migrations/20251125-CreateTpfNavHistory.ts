import { MigrationInterface, QueryRunner, Table, TableForeignKey } from 'typeorm';

export class CreateTpfNavHistory20251125000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'tpf_nav_history',
        columns: [
          {
            name: 'id',
            type: 'serial',
            isPrimary: true,
          },
          {
            name: 'scheme_id',
            type: 'integer',
            isNullable: false
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
            name: 'status',
            type: 'integer',
            isNullable: false,
            default: '1',
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

    await queryRunner.createForeignKey(
      'tpf_nav_history',
      new TableForeignKey({
        columnNames: ['scheme_id'],
        referencedTableName: 'tpf_schemes',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('tpf_nav_history');
    if (table) {
      const fkRole = table.foreignKeys.find(fk => fk.columnNames.includes('scheme_id'));
      if (fkRole) await queryRunner.dropForeignKey('tpf_nav_history', fkRole);
    }
    await queryRunner.dropTable('tpf_nav_history');
  }
}
