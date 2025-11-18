import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateWebAnonRole20251126000000 implements MigrationInterface {
	public async up(queryRunner: QueryRunner): Promise<void> {
		// create role
		await queryRunner.query(`CREATE ROLE web_anon;`);

		// allow usage of public schema
		await queryRunner.query(`GRANT USAGE ON SCHEMA public TO web_anon;`);

		// grant select on specific tables
		await queryRunner.query(`
			GRANT SELECT ON TABLE
				public.tpf_authorizations,
				public.tpf_document_categories,
				public.tpf_documents,
				public.tpf_role_authorizations,
				public.tpf_roles,
				public.tpf_schemes,
				public.tpf_nav_history,
				public.tpf_users
			TO web_anon;
		`);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		// revoke select on specific tables
		await queryRunner.query(`
			REVOKE SELECT ON TABLE
				public.tpf_authorizations,
				public.tpf_document_categories,
				public.tpf_documents,
				public.tpf_role_authorizations,
				public.tpf_roles,
				public.tpf_schemes,
				public.tpf_nav_history,
				public.tpf_users
			FROM web_anon;
		`);

		// revoke usage on schema and drop role
		await queryRunner.query(`REVOKE USAGE ON SCHEMA public FROM web_anon;`);
		await queryRunner.query(`DROP ROLE IF EXISTS web_anon;`);
	}
}