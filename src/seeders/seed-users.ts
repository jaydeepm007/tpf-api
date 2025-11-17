import { first } from 'rxjs';
import AppDataSource from '../data-source';
import bcrypt from 'bcryptjs';

export async function seedUsers() {
  await AppDataSource.initialize();
  try {
    const tableExistsRes: Array<{ exists: boolean }> = await AppDataSource.query(
      `SELECT EXISTS (
         SELECT 1 FROM information_schema.tables
         WHERE table_schema = 'public' AND table_name = 'tpf_users'
       ) AS exists`,
    );

    if (!tableExistsRes?.[0]?.exists) {
      console.info('seedUsers: tpf_users table not present, skipping');
      return;
    }

    const colsRes: Array<{
      column_name: string;
      data_type: string;
      is_nullable: string;
      column_default: string | null;
    }> = await AppDataSource.query(
      `SELECT column_name, data_type, is_nullable, column_default
       FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'tpf_users'`,
    );
    const cols = new Set(colsRes.map(c => c.column_name));

    const defaultUser = {
      first_name: 'Admin',
      last_name: 'User',
      email: 'admin@example.com',
      password: 'Password123!', // plaintext -> will be hashed
      roleName: 'Super Admin'
    };

    const hashed = bcrypt.hashSync(defaultUser.password, 8);

    // Find role id if role_id column exists and role is present
    let roleId: number | null = null;
    if (cols.has('role_id')) {
      const r = await AppDataSource.query(`SELECT id FROM tpf_roles WHERE name = $1 LIMIT 1`, [defaultUser.roleName]);
      if (r?.[0]?.id) roleId = r[0].id;
    }

    // Prepare insert columns and values
    const insertCols: string[] = [];
    const valueParts: string[] = [];
    const params: any[] = [];

    // Always include email and password
    insertCols.push('email', 'password');
    params.push(defaultUser.email, hashed);
    valueParts.push('$1::varchar', '$2::varchar');
    let paramIndex = 2;

    if (roleId !== null && cols.has('role_id')) {
      paramIndex++;
      insertCols.push('role_id');
      params.push(roleId);
      valueParts.push(`$${paramIndex}::int`);
    }

    // Determine required columns that would cause NOT NULL violations
    const skipCols = new Set(['id', 'created_at', 'updated_at', 'deleted_at']);
    for (const c of colsRes) {
      if (skipCols.has(c.column_name)) continue;
      if (insertCols.includes(c.column_name)) continue;
      if (c.is_nullable === 'NO' && (c.column_default === null || c.column_default === undefined)) {
        // supply sensible defaults based on type/name
        const name = c.column_name.toLowerCase();
        const dt = c.data_type.toLowerCase();
        if (dt.includes('char') || dt === 'text' || dt === 'character') {
          // pick friendly defaults for name-like columns
          let val = 'N/A';
          if (name.includes('first_name')) val = 'Admin';
          else if (name.includes('last_name')) val = 'User';
          else if (name.includes('email')) val = defaultUser.email;
          paramIndex++;
          insertCols.push(c.column_name);
          params.push(val);
          valueParts.push(`$${paramIndex}::varchar`);
        } else if (dt === 'boolean') {
          insertCols.push(c.column_name);
          valueParts.push('false');
        } else if (dt.includes('int') || dt === 'numeric' || dt === 'decimal' || dt === 'bigint' || dt === 'smallint') {
          insertCols.push(c.column_name);
          valueParts.push('0');
        } else if (dt.includes('time') || dt === 'timestamp' || dt.includes('date')) {
          insertCols.push(c.column_name);
          valueParts.push('now()');
        } else if (dt === 'uuid') {
          insertCols.push(c.column_name);
          valueParts.push('gen_random_uuid()'); // requires pgcrypto/pgcrypto or pgcrypto extension; if not present it may fail
        } else {
          // fallback to empty string param
          paramIndex++;
          insertCols.push(c.column_name);
          params.push('N/A');
          valueParts.push(`$${paramIndex}::varchar`);
        }
      }
    }

    // Final INSERT: include created_at if present and not defaulted (we try to set it to now())
    const createdAtCol = cols.has('created_at') ? 'created_at' : null;
    let finalInsertCols = insertCols.slice();
    let finalValueParts = valueParts.slice();
    if (createdAtCol) {
      finalInsertCols.push('created_at');
      finalValueParts.push('now()');
    }

    // Build SQL only if email/password columns exist
    if (cols.has('email') && cols.has('password')) {
      const sql = `INSERT INTO tpf_users (${finalInsertCols.join(', ')})
                   SELECT ${finalValueParts.join(', ')}
                   WHERE NOT EXISTS (SELECT 1 FROM tpf_users WHERE email = $1::varchar)`;
      await AppDataSource.query(sql, params);
      console.info('seedUsers: done');
    } else {
      console.info('seedUsers: required columns (email,password) not present, skipping');
    }
  } finally {
    await AppDataSource.destroy();
  }
}
