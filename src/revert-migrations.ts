import AppDataSource from './data-source';

async function revert() {
  try {
    await AppDataSource.initialize();
    const reverted = await AppDataSource.undoLastMigration();
    console.log('Reverted migration:', reverted ? reverted.name ?? reverted : reverted);
  } catch (err) {
    console.error('Failed to revert migration:', err);
    process.exitCode = 1;
  } finally {
    await AppDataSource.destroy();
  }
}

revert();
