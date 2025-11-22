import { readFileSync } from 'fs';
import { join } from 'path';
import sqlite3 from 'sqlite3';

// Enable verbose mode in development
const sqlite = process.env.NODE_ENV === 'development' ? sqlite3.verbose() : sqlite3;

class Database {
  private db: sqlite3.Database;
  private static instance: Database;

  private constructor() {
    const dbPath = process.env.NODE_ENV === 'production' 
      ? '/tmp/testcase-generator.db' 
      : join(process.cwd(), 'data', 'testcase-generator.db');
    
    this.db = new sqlite.Database(dbPath, (err) => {
      if (err) {
        console.error('Error opening database:', err.message);
        process.exit(1);
      } else {
        console.log(`📊 Connected to SQLite database at ${dbPath}`);
        this.initializeSchema();
      }
    });
  }

  public static getInstance(): Database {
    if (!Database.instance) {
      Database.instance = new Database();
    }
    return Database.instance;
  }

  private initializeSchema(): void {
    try {
      const schemaPath = join(__dirname, 'schema.sql');
      const schema = readFileSync(schemaPath, 'utf8');
      
      this.db.exec(schema, (err) => {
        if (err) {
          console.error('Error initializing database schema:', err.message);
          process.exit(1);
        } else {
          console.log('✅ Database schema initialized');
        }
      });
    } catch (error) {
      console.error('Error reading schema file:', error);
      process.exit(1);
    }
  }

  public getDb(): sqlite3.Database {
    return this.db;
  }

  public close(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.close((err) => {
        if (err) {
          reject(err);
        } else {
          console.log('📊 Database connection closed');
          resolve();
        }
      });
    });
  }

  // Helper methods for common database operations
  public run(sql: string, params: any[] = []): Promise<sqlite3.RunResult> {
    return new Promise((resolve, reject) => {
      this.db.run(sql, params, function(err) {
        if (err) {
          reject(err);
        } else {
          resolve(this);
        }
      });
    });
  }

  public get<T = any>(sql: string, params: any[] = []): Promise<T | undefined> {
    return new Promise((resolve, reject) => {
      this.db.get(sql, params, (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row as T);
        }
      });
    });
  }

  public all<T = any>(sql: string, params: any[] = []): Promise<T[]> {
    return new Promise((resolve, reject) => {
      this.db.all(sql, params, (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows as T[]);
        }
      });
    });
  }
}

export default Database;
