import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import dotenv from 'dotenv';
import apiRouter from './routes/api';
dotenv.config();

const app = express();
app.use(cors());
app.use(bodyParser.json({ limit: '2mb' }));
app.use(bodyParser.urlencoded({ extended: true }));

app.get('/', (_req, res) => res.send('tpf-backend running'));

app.use('/api', apiRouter);

const PORT = process.env.PORT || 3200;

// start server directly (no DB initialization)
app.listen(PORT, () => {
  console.log(`Server listening on ${process.env.DOMAIN || `http://localhost:${PORT}`}`);
});
