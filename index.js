const express = require('express');

const cookiesParser = require('cookie-parser');

const controllers = require('./controllers.js');

const app = express();
const port = 3000;

const db = require('better-sqlite3')('data.db');
try {
    const stmt = db.prepare('CREATE TABLE tokens (\
        TokenID INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,\
        ProjectID INTEGER NOT NULL,\
        Token varchar(255) NOT NULL\
    )');
    const result = stmt.run();
} catch(error) {
    console.error;
}

app.set('view engine', 'ejs');

app.use(cookiesParser());
app.use(express.urlencoded({ extended: true }))
app.use(express.json());


app.get('/', controllers.index);

app.get('/login', controllers.login);
app.post('/login', controllers.storeLogin);

app.post('/download', controllers.download);

// app.post('/upload', controllers.upload);

app.listen(port, () => {
    console.log(`Example app listening on port ${port}`);
});