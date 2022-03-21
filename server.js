//mongodb
require('./config/db')

const app = require ('express')();
const port = process.env.PORT || 3000;

const UserRouter = require('./api/User');

// aceitar post vindo da data
const bodyParser = require('express').json;
app.use(bodyParser());

app.use('/user', UserRouter)

app.listen (port, () => {
    console.log(`Server running on port ${port}`);
})