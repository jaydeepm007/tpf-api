import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateFnTpfNavHistoryTrigger20251127000000 implements MigrationInterface {
	public async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`
			CREATE OR REPLACE FUNCTION fn_tpf_nav_history_trigger()
			RETURNS TRIGGER AS $$
			BEGIN
				INSERT INTO tpf_nav_history (
					pfm_id,
					scheme_id,
					scheme_code,
					scheme_name,
					asset_category,
					contribution_type,
					status,
					modified_nav,
					modified_nav_date,
					nav,
					nav_date,
					create_date
				)
				VALUES (
					NEW.pfm_id,
					NEW.id,
					NEW.scheme_code,
					NEW.scheme_name,
					NEW.asset_category,
					NEW.contribution_type,
					NEW.status,
					NEW.modified_nav,
					NEW.modified_nav_date,
					NEW.nav,
					NEW.nav_date,
					NOW()
				);

				RETURN NEW;
			END;
			$$ LANGUAGE plpgsql;
		`);

		await queryRunner.query(`
			CREATE TRIGGER trg_tpf_nav_history
			AFTER INSERT OR UPDATE ON tpf_schemes
			FOR EACH ROW
			WHEN (NEW.status = 2)
			EXECUTE FUNCTION fn_tpf_nav_history_trigger();
		`);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`
			DROP TRIGGER IF EXISTS trg_tpf_nav_history ON tpf_schemes;
		`);
		await queryRunner.query(`
			DROP FUNCTION IF EXISTS fn_tpf_nav_history_trigger();
		`);
	}
}