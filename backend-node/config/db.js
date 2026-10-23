import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

// Create MySQL Connection Pool
export const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT || 3306,
    ssl: {
        rejectUnauthorized: false
    },
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// Function to initialize tables automatically
export async function initDatabase() {
    try {
        const connection = await pool.getConnection();
        console.log('⚡ Connected to Aiven MySQL Database Successfully!');

        // 1. Users Table
        await connection.query(`
            CREATE TABLE IF NOT EXISTS users (
                id INT AUTO_INCREMENT PRIMARY KEY,
                email VARCHAR(255) UNIQUE NOT NULL,
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

        // 2. Courses/Subjects Table
        await connection.query(`
            CREATE TABLE IF NOT EXISTS courses (
                id INT AUTO_INCREMENT PRIMARY KEY,
                code VARCHAR(50) UNIQUE NOT NULL,
                name VARCHAR(255) NOT NULL,
                branch VARCHAR(50) NOT NULL
            );
        `);

        // 3. Educational Resources Table (PDFs, Videos, Books, PYQs, etc.)
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

        // Insert Default Courses (Sample Data if empty)
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

            // Insert Initial Sample Educational Content with Views, Likes & Ratings
            await connection.query(`
                INSERT INTO resources (course_code, title, description, type, url, views_count, likes_count, rating) VALUES
                ('DSA', 'Striver A2Z DSA Course & Notes', 'Complete roadmap with video tutorials and practice code for Data Structures.', 'roadmap', 'https://takeuforward.org/strivers-a2z-dsa-course/strivers-a2z-dsa-course-sheet-2/', 1250, 340, 4.90),
                ('DSA', 'Abdul Bari Algorithms Playlist', 'High quality visualization videos explaining asymptotic analysis and dynamic programming.', 'video', 'https://www.youtube.com/playlist?list=PLDN4rrl4ha5o0EL02X0OAGK26A4fM3d9b', 2400, 890, 4.95),
                ('DSA', 'Data Structures Gate PYQs (2015-2024)', 'Previous years solved questions with explanations.', 'pyq', 'https://geeksforgeeks.org', 650, 120, 4.50),
                ('JAVA', 'Java Complete Reference Book PDF', 'Standard reference textbook by Herbert Schildt.', 'book', 'https://example.com/java.pdf', 800, 210, 4.70),
                ('DBMS', 'DBMS Gate Smashers Full Playlist', 'Quick revision videos covering ER Diagrams, SQL Queries, and Normalization.', 'video', 'https://youtube.com', 3100, 950, 4.85),
                ('OS', 'Galvin Operating System Concepts', 'Classic Dinosaur book for OS core concepts and memory management.', 'pdf', 'https://example.com/os.pdf', 450, 90, 4.30);
            `);
            console.log('🌱 Sample Courses and Educational Resources Seeded into Database!');
        }

        connection.release();
    } catch (error) {
        console.error('❌ Error initializing database tables:', error);
    }
}