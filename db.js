require("dotenv").config();

const mysql = require('mysql2')

const connection = mysql.createConnection({
    host: process.env.HOST,
    user: process.env.USERDB,
    password: process.env.PASSWORD,
    database: process.env.DATABASE
});

connection.connect((err) => {
    if (err) {
        console.error('Error trying to connect to db: ' + err.stack);
        return;
    }
    console.log('Connected with id: ' + connection.threadId);
});

module.exports = connection;
