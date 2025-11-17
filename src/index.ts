import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import dotenv from 'dotenv';
import apiRouter from './routes/api';
import { Pool } from 'pg';
dotenv.config();

const app = express();
app.use(cors());
app.use(bodyParser.json({ limit: '2mb' }));
app.use(bodyParser.urlencoded({ extended: true }));

app.get('/', (_req, res) => res.send('tpf-backend running'));

app.use('/api', apiRouter);

const PORT = process.env.PORT || 3200;

// Create Postgres pool (use DATABASE_URL or individual PG* env vars)
const pool = new Pool({
	// prefer DATABASE_URL if provided
	connectionString: process.env.DATABASE_URL || undefined,
	host: process.env.PGHOST,
	user: process.env.PGUSER,
	password: process.env.PGPASSWORD,
	database: process.env.PGDATABASE,
	port: process.env.PGPORT ? parseInt(process.env.PGPORT, 10) : undefined,
	ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined,
});

// Ensure DB is reachable before starting the server
async function initDbAndStart() {
	try {
		await pool.query('SELECT 1');
		console.log('Postgres connected');
		app.listen(PORT, () => {
			console.log(`Server listening on ${process.env.DOMAIN || `http://localhost:${PORT}`}`);
		});
	} catch (err) {
		console.error('Failed to connect to Postgres:', err);
		// Close pool and exit with failure
		try { await pool.end(); } catch (_) {}
		process.exit(1);
	}
}

// Start
initDbAndStart();

// export pool for use in other modules
export { pool };
