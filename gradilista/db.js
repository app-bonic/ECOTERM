'use strict';
/*
 * Baza podataka.
 *  - Lokalno (zadano): SQLite datoteka u data/gradilista.db – ne treba ništa instalirati.
 *  - Na hostingu: MySQL / MariaDB – postavi DB_CLIENT=mysql i DB_HOST, DB_USER, DB_PASSWORD, DB_NAME.
 * Tablice se same naprave pri prvom pokretanju.
 * Vremena se spremaju kao milisekunde (Date.now()) da isti SQL radi u obje baze.
 */
const fs = require('fs');
const path = require('path');

const SCHEMA = {
  sqlite: [
    `CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name VARCHAR(80) NOT NULL,
      role VARCHAR(10) NOT NULL DEFAULT 'radnik',
      active INTEGER NOT NULL DEFAULT 1,
      created_at BIGINT NOT NULL)`,
    `CREATE TABLE IF NOT EXISTS devices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      token_hash CHAR(64) NOT NULL UNIQUE,
      label VARCHAR(120),
      created_at BIGINT NOT NULL,
      last_seen BIGINT NOT NULL)`,
    `CREATE TABLE IF NOT EXISTS invites (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      token_hash CHAR(64) NOT NULL UNIQUE,
      name VARCHAR(80),
      role VARCHAR(10) NOT NULL,
      user_id INTEGER,
      created_by INTEGER NOT NULL,
      created_at BIGINT NOT NULL,
      expires_at BIGINT NOT NULL,
      used_at BIGINT)`,
    `CREATE TABLE IF NOT EXISTS sites (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name VARCHAR(120) NOT NULL,
      address VARCHAR(200),
      client_name VARCHAR(120),
      client_phone VARCHAR(40),
      note TEXT,
      status VARCHAR(12) NOT NULL DEFAULT 'u_tijeku',
      created_by INTEGER NOT NULL,
      created_at BIGINT NOT NULL)`,
    `CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      site_id INTEGER NOT NULL,
      user_id INTEGER,
      kind VARCHAR(8) NOT NULL,
      body TEXT,
      image VARCHAR(80),
      thumb VARCHAR(80),
      created_at BIGINT NOT NULL)`,
    `CREATE INDEX IF NOT EXISTS messages_site ON messages (site_id, id)`,
    `CREATE TABLE IF NOT EXISTS site_reads (
      user_id INTEGER NOT NULL,
      site_id INTEGER NOT NULL,
      last_read_id INTEGER NOT NULL,
      PRIMARY KEY (user_id, site_id))`,
  ],
  mysql: [
    `CREATE TABLE IF NOT EXISTS users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(80) NOT NULL,
      role VARCHAR(10) NOT NULL DEFAULT 'radnik',
      active TINYINT NOT NULL DEFAULT 1,
      created_at BIGINT NOT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
    `CREATE TABLE IF NOT EXISTS devices (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      token_hash CHAR(64) NOT NULL UNIQUE,
      label VARCHAR(120),
      created_at BIGINT NOT NULL,
      last_seen BIGINT NOT NULL,
      INDEX devices_user (user_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
    `CREATE TABLE IF NOT EXISTS invites (
      id INT AUTO_INCREMENT PRIMARY KEY,
      token_hash CHAR(64) NOT NULL UNIQUE,
      name VARCHAR(80),
      role VARCHAR(10) NOT NULL,
      user_id INT,
      created_by INT NOT NULL,
      created_at BIGINT NOT NULL,
      expires_at BIGINT NOT NULL,
      used_at BIGINT
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
    `CREATE TABLE IF NOT EXISTS sites (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(120) NOT NULL,
      address VARCHAR(200),
      client_name VARCHAR(120),
      client_phone VARCHAR(40),
      note TEXT,
      status VARCHAR(12) NOT NULL DEFAULT 'u_tijeku',
      created_by INT NOT NULL,
      created_at BIGINT NOT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
    `CREATE TABLE IF NOT EXISTS messages (
      id INT AUTO_INCREMENT PRIMARY KEY,
      site_id INT NOT NULL,
      user_id INT,
      kind VARCHAR(8) NOT NULL,
      body TEXT,
      image VARCHAR(80),
      thumb VARCHAR(80),
      created_at BIGINT NOT NULL,
      INDEX messages_site (site_id, id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
    `CREATE TABLE IF NOT EXISTS site_reads (
      user_id INT NOT NULL,
      site_id INT NOT NULL,
      last_read_id INT NOT NULL,
      PRIMARY KEY (user_id, site_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  ],
};

async function openMysql() {
  const mysql = require('mysql2/promise');
  const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    charset: 'utf8mb4',
    connectionLimit: 5,
  });
  for (const sql of SCHEMA.mysql) await pool.query(sql);
  return {
    client: 'mysql',
    async all(sql, params = []) {
      const [rows] = await pool.query(sql, params);
      return rows;
    },
    async get(sql, params = []) {
      const [rows] = await pool.query(sql, params);
      return rows[0];
    },
    async run(sql, params = []) {
      const [res] = await pool.query(sql, params);
      return { insertId: res.insertId, changes: res.affectedRows };
    },
  };
}

async function openSqlite() {
  const { DatabaseSync } = require('node:sqlite');
  const file = path.resolve(process.env.DB_FILE || path.join(__dirname, 'data', 'gradilista.db'));
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec('PRAGMA journal_mode = WAL');
  for (const sql of SCHEMA.sqlite) db.exec(sql);
  return {
    client: 'sqlite',
    async all(sql, params = []) {
      return db.prepare(sql).all(...params);
    },
    async get(sql, params = []) {
      return db.prepare(sql).get(...params);
    },
    async run(sql, params = []) {
      const res = db.prepare(sql).run(...params);
      return { insertId: Number(res.lastInsertRowid), changes: Number(res.changes) };
    },
  };
}

async function openDb() {
  return (process.env.DB_CLIENT || 'sqlite').toLowerCase() === 'mysql' ? openMysql() : openSqlite();
}

module.exports = { openDb };
