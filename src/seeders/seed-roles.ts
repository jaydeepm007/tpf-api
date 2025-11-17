import AppDataSource from '../data-source';

export async function seedRoles() {
  const roles = [
    { name: 'Super Admin', is_super_admin: true },
    { name: 'Admin', is_super_admin: false },
  ];

  await AppDataSource.initialize();
  try {
    for (const r of roles) {
      await AppDataSource.query(
        `INSERT INTO tpf_roles (name, is_super_admin, created_at, updated_at)
         SELECT $1::varchar, $2::boolean, now(), now()
         WHERE NOT EXISTS (SELECT 1 FROM tpf_roles WHERE name = $1::varchar)`,
        [r.name, r.is_super_admin],
      );
    }
    console.info('seedRoles: done');
  } finally {
    await AppDataSource.destroy();
  }
}
