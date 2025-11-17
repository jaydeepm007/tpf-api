import AppDataSource from '../data-source';

export async function seedRoleAuthorizations() {
  const mappings = [
    { roleName: 'Super Admin', authName: 'view_roles' },
    { roleName: 'Super Admin', authName: 'view_authorizations' },
    { roleName: 'Super Admin', authName: 'view_role_authorizations' },
    { roleName: 'Super Admin', authName: 'view_users' },
    { roleName: 'Super Admin', authName: 'view_contact_us' },
    { roleName: 'Super Admin', authName: 'view_document_categories' },
    { roleName: 'Super Admin', authName: 'view_documents' },
    { roleName: 'Super Admin', authName: 'view_tpf_schemes' },
    { roleName: 'Super Admin', authName: 'view_nav_history' },
    { roleName: 'Admin', authName: 'view_document_categories' },
    { roleName: 'Admin', authName: 'view_documents' },
    { roleName: 'Admin', authName: 'view_tpf_schemes' },
    { roleName: 'Admin', authName: 'view_nav_history' },
    { roleName: 'Admin', authName: 'view_contact_us' }
  ];

  await AppDataSource.initialize();
  try {
    for (const m of mappings) {
      await AppDataSource.query(
        `INSERT INTO tpf_role_authorizations (role_id, authorization_id, created_at, updated_at)
         SELECT r.id, a.id, now(), now()
         FROM tpf_roles r, tpf_authorizations a
         WHERE r.name = $1 AND a.name = $2
           AND NOT EXISTS (
             SELECT 1 FROM tpf_role_authorizations ra
             WHERE ra.role_id = r.id AND ra.authorization_id = a.id
           )`,
        [m.roleName, m.authName],
      );
    }
    console.info('seedRoleAuthorizations: done');
  } finally {
    await AppDataSource.destroy();
  }
}
