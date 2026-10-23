import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import authRoutes from './routes/auth.routes.js'; // Make sure file name case matches exactly

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// API Routes
app.use('/api/auth', authRoutes);

// Serve Static Frontend Files
const pagesPath = path.join(__dirname, '../frontend/public/pages');
app.use(express.static(pagesPath));

// Default route -> Start at Login (index.html)
app.get('/', (req, res) => {
    res.sendFile(path.join(pagesPath, 'index.html'));
});

// Server Listening
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Backend Server is running live on http://localhost:${PORT}`);
});