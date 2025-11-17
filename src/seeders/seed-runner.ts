import { seedRoles } from './seed-roles';
import { seedAuthorizations } from './seed-authorizations';
import { seedRoleAuthorizations } from './seed-role-authorizations';
import { seedUsers } from './seed-users';

async function runAll() {
  try {
    console.info('Seeding roles...');
    await seedRoles();

    console.info('Seeding authorizations...');
    await seedAuthorizations();

    console.info('Seeding role_authorizations...');
    await seedRoleAuthorizations();

    console.info('Seeding users...');
    await seedUsers();

    console.info('All seeders complete');
    process.exit(0);
  } catch (err) {
    console.error('Seeding failed', err);
    process.exit(1);
  }
}

runAll();
