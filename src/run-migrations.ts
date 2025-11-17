import AppDataSource from './data-source';

async function run() {
  try {
    await AppDataSource.initialize();
    const applied = await AppDataSource.runMigrations();
    console.log('Migrations applied:', applied.map(m => m.name));
  } catch (err) {
    console.error('Failed to run migrations:', err);
    process.exitCode = 1;
  } finally {
    await AppDataSource.destroy();
  }
}

run();
