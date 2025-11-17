import AppDataSource from '../data-source';

export async function seedAuthorizations() {
  const auths = [
    { resource_name: 'ViewRoles', name: 'view_roles', attribute_name: 'view', locale_en: 'View Roles' },
    { resource_name: 'ViewAuthorizations', name: 'view_authorizations', attribute_name: 'view', locale_en: 'View Authorizations' },
    { resource_name: 'ViewRoleAuthorizations', name: 'view_role_authorizations', attribute_name: 'view', locale_en: 'View Role Authorizations' },
    { resource_name: 'ViewUsers', name: 'view_users', attribute_name: 'view', locale_en: 'View Users' },
    { resource_name: 'ViewContactUs', name: 'view_contact_us', attribute_name: 'view', locale_en: 'View Contact Us' },
    { resource_name: 'ViewDocumentCategories', name: 'view_document_categories', attribute_name: 'view', locale_en: 'View Document Categories' },
    { resource_name: 'ViewDocuments', name: 'view_documents', attribute_name: 'view', locale_en: 'View Documents' },
    { resource_name: 'ViewTpfSchemes', name: 'view_tpf_schemes', attribute_name: 'view', locale_en: 'View Tpf Schemes' },
    { resource_name: 'ViewNavHistory', name: 'view_nav_history', attribute_name: 'view', locale_en: 'View Nav History' },
  ];

  await AppDataSource.initialize();
  try {
    for (const a of auths) {
      await AppDataSource.query(
        `INSERT INTO tpf_authorizations (resource_name, name, attribute_name, locale_en, created_at, updated_at)
         SELECT $1::varchar, $2::varchar, $3::varchar, $4::varchar, now(), now()
         WHERE NOT EXISTS (
           SELECT 1 FROM tpf_authorizations
           WHERE resource_name = $1 AND name = $2 AND attribute_name = $3 AND locale_en = $4
         )`,
        [a.resource_name, a.name, a.attribute_name, a.locale_en],
      );
    }
    console.info('seedAuthorizations: done');
  } finally {
    await AppDataSource.destroy();
  }
}
