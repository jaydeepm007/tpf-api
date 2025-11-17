import { MigrationInterface, QueryRunner, Table, TableForeignKey } from 'typeorm';

export class CreateAuthorizations20251117000100 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'tpf_authorizations',
        columns: [
          { name: 'id', type: 'serial', isPrimary: true },
          { name: 'resource_name', type: 'varchar', length: '255', isNullable: false },
          { name: 'name', type: 'varchar', length: '255', isNullable: false },
          { name: 'attribute_name', type: 'varchar', length: '255', isNullable: false },
          { name: 'locale_en', type: 'varchar', length: '255', isNullable: false},
          { name: 'created_at', type: 'timestamp with time zone', default: 'now()', isNullable: false },
          { name: 'updated_at', type: 'timestamp with time zone', default: 'now()', isNullable: false },
        ],
        uniques: [
          { columnNames: ['resource_name', 'name', 'attribute_name', 'locale_en'] }
        ],
      }),
      true,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('tpf_authorizations');
  }
}
