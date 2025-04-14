require("dotenv").config();
const mysql = require("mysql2");

const pool = mysql
    .createPool({
        host: process.env.HOST,
        user: process.env.USERDB,
        password: process.env.PASSWORD,
        database: process.env.DATABASE,
        waitForConnections: true,
        connectionLimit: 15,
        queueLimit: 0,
    })
    .promise();

module.exports = pool;

