import { MigrationInterface, QueryRunner, Table, TableForeignKey } from 'typeorm';

export class CreateRoleAuthorizations20251118000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'tpf_role_authorizations',
        columns: [
          { name: 'id', type: 'serial', isPrimary: true },
          { name: 'role_id', type: 'integer', isNullable: false },
          { name: 'authorization_id', type: 'integer', isNullable: false },
          { name: 'created_at', type: 'timestamp with time zone', default: 'now()', isNullable: false },
          { name: 'updated_at', type: 'timestamp with time zone', default: 'now()', isNullable: false },
        ],
        uniques: [
          { columnNames: ['role_id', 'authorization_id'] }
        ],
      }),
      true,
    );

    await queryRunner.createForeignKey(
      'tpf_role_authorizations',
      new TableForeignKey({
        columnNames: ['role_id'],
        referencedTableName: 'tpf_roles',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );

    await queryRunner.createForeignKey(
      'tpf_role_authorizations',
      new TableForeignKey({
        columnNames: ['authorization_id'],
        referencedTableName: 'tpf_authorizations',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('tpf_role_authorizations');
    if (table) {
      const fkRole = table.foreignKeys.find(fk => fk.columnNames.includes('role_id'));
      if (fkRole) await queryRunner.dropForeignKey('tpf_role_authorizations', fkRole);
      const fkAuth = table.foreignKeys.find(fk => fk.columnNames.includes('authorization_id'));
      if (fkAuth) await queryRunner.dropForeignKey('tpf_role_authorizations', fkAuth);
    }
    await queryRunner.dropTable('tpf_role_authorizations');
  }
}
