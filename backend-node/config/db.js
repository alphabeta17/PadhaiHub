import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

export const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: Number(process.env.DB_PORT) || 3306,
    ssl: { rejectUnauthorized: false },
    connectTimeout: 30000, // Timeout badhaya gaya hai taaki ETIMEDOUT na aaye
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

export async function initDatabase() {
    try {
        const connection = await pool.getConnection();
        console.log('⚡ Connected to Aiven MySQL Database Successfully!');

        // 1. Users Table Creation (Safe without drop)
        await connection.query(`
            CREATE TABLE IF NOT EXISTS users (
                id INT AUTO_INCREMENT PRIMARY KEY,
                email VARCHAR(255) UNIQUE NOT NULL,
                password VARCHAR(255) DEFAULT 'default123',
                fullName VARCHAR(255),
                university VARCHAR(255),
                course VARCHAR(100),
                semester VARCHAR(20),
                roll VARCHAR(100),
                address TEXT,
                linkedin TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        // Safe check: Agar purani table mein password column nahi hai toh add kar do
        try {
            await connection.query(`ALTER TABLE users ADD COLUMN password VARCHAR(255) DEFAULT 'default123'`);
        } catch (e) {
            // Column pehle se exist karta hai toh ignore karega
        }

        // 2. Courses Table
        await connection.query(`
            CREATE TABLE IF NOT EXISTS courses (
                id INT AUTO_INCREMENT PRIMARY KEY,
                code VARCHAR(50) UNIQUE NOT NULL,
                name VARCHAR(255) NOT NULL,
                branch VARCHAR(50) NOT NULL
            );
        `);

        // 3. Resources Table
        await connection.query(`
            CREATE TABLE IF NOT EXISTS resources (
                id INT AUTO_INCREMENT PRIMARY KEY,
                course_code VARCHAR(50),
                title VARCHAR(255) NOT NULL,
                description TEXT,
                type ENUM('video', 'pdf', 'article', 'book', 'pyq', 'roadmap') NOT NULL,
                url TEXT NOT NULL,
                views_count INT DEFAULT 0,
                likes_count INT DEFAULT 0,
                rating DECIMAL(3,2) DEFAULT 4.00,
                FOREIGN KEY (course_code) REFERENCES courses(code) ON DELETE CASCADE
            );
        `);

        // Seed Default Courses if empty
        const [existingCourses] = await connection.query(`SELECT COUNT(*) as count FROM courses`);
        if (existingCourses[0].count === 0) {
            await connection.query(`
                INSERT INTO courses (code, name, branch) VALUES
                ('DSA', 'Data Structures and Algorithms', 'CSE'),
                ('JAVA', 'Object-Oriented Programming Java', 'CSE'),
                ('DBMS', 'Database Management Systems', 'CSE'),
                ('OS', 'Operating Systems', 'CSE'),
                ('THERMO', 'Thermodynamics', 'ME'),
                ('EDC', 'Electronic Devices & Circuits', 'ECE');
            `);

            await connection.query(`
                INSERT INTO resources (course_code, title, description, type, url, views_count, likes_count, rating) VALUES
                ('DSA', 'Striver A2Z DSA Course & Notes', 'Complete roadmap with video tutorials and practice code.', 'roadmap', 'https://takeuforward.org/strivers-a2z-dsa-course/strivers-a2z-dsa-course-sheet-2/', 1250, 340, 4.90),
                ('DSA', 'Abdul Bari Algorithms Playlist', 'High quality visualization videos explaining algorithms.', 'video', 'https://www.youtube.com/playlist?list=PLDN4rrl4ha5o0EL02X0OAGK26A4fM3d9b', 2400, 890, 4.95),
                ('DBMS', 'DBMS Gate Smashers Full Playlist', 'Quick revision videos covering ER Diagrams and SQL.', 'video', 'https://youtube.com', 3100, 950, 4.85);
            `);
            console.log('🌱 Sample Data Seeded into Database!');
        }

        connection.release();
    } catch (error) {
        console.error('❌ Error initializing database tables:', error.message);
    }
}
