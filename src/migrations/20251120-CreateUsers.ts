import { MigrationInterface, QueryRunner, Table, TableForeignKey } from 'typeorm';

export class CreateUsers20251120000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'tpf_users',
        columns: [
          { name: 'id', type: 'serial', isPrimary: true },
          { name: 'first_name', type: 'varchar', length: '255', isNullable: false },
          { name: 'last_name', type: 'varchar', length: '255', isNullable: false },
          { name: 'email', type: 'varchar', length: '255', isNullable: false, isUnique: true },
          { name: 'password', type: 'varchar', length: '255', isNullable: false },
          { name: 'role_id', type: 'integer', isNullable: false },
          { name: 'created_at', type: 'timestamp with time zone', default: 'now()', isNullable: false },
          { name: 'updated_at', type: 'timestamp with time zone', default: 'now()', isNullable: false },
        ],
        uniques: [
          { columnNames: ['email'] }
        ],
      }),
      true,
    );

    await queryRunner.createForeignKey(
      'tpf_users',
      new TableForeignKey({
        columnNames: ['role_id'],
        referencedTableName: 'tpf_roles',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('tpf_users');
    if (table) {
      const fkRole = table.foreignKeys.find(fk => fk.columnNames.includes('role_id'));
      if (fkRole) await queryRunner.dropForeignKey('tpf_users', fkRole);
    }
    await queryRunner.dropTable('tpf_users');
  }
}
