import { MigrationInterface, QueryRunner, Table, TableForeignKey } from 'typeorm';

export class CreateDocuments20251123000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'tpf_documents',
        columns: [
          { name: 'id', type: 'serial', isPrimary: true },
          { name: 'document_category_id', type: 'integer', isNullable: false },
          { name: 'document_sub_category_id', type: 'integer', isNullable: true },
          { name: 'name', type: 'varchar', length: '255', isNullable: false },
          { name: 'file', type: 'varchar', length: '255', isNullable: false },
          {
            name: 'status',
            type: 'integer',
            isNullable: false,
            default: '1',
          },
          { name: 'is_active', type: 'boolean', isNullable: false, default: 'true' },
          { name: 'created_at', type: 'timestamp with time zone', default: 'now()', isNullable: false },
          { name: 'updated_at', type: 'timestamp with time zone', default: 'now()', isNullable: false },
        ],
      }),
      true,
    );

    await queryRunner.createForeignKey(
      'tpf_documents',
      new TableForeignKey({
        columnNames: ['document_category_id'],
        referencedTableName: 'tpf_document_categories',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );

    await queryRunner.createForeignKey(
      'tpf_documents',
      new TableForeignKey({
        columnNames: ['document_sub_category_id'],
        referencedTableName: 'tpf_document_sub_categories',
        referencedColumnNames: ['id'],
        onDelete: 'SET NULL',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('tpf_documents');
    if (table) {
      const fkRole = table.foreignKeys.find(fk => fk.columnNames.includes('document_category_id'));
      if (fkRole) await queryRunner.dropForeignKey('tpf_documents', fkRole);
      const fkSubCategory = table.foreignKeys.find(fk => fk.columnNames.includes('document_sub_category_id'));
      if (fkSubCategory) await queryRunner.dropForeignKey('tpf_documents', fkSubCategory);
    }
    await queryRunner.dropTable('tpf_documents');
  }
}
