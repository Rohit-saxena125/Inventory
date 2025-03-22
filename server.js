require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const port = process.env.PORT || 8000;
const http = require('http');
const app = express();
const { rateLimit } = require('express-rate-limit');
const server = http.createServer(app);
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const package = require('./package.json');
const exitHandler = require('./utils/exitHandler')(server);
const queryParser = require('./middlewares/queryParser');
const connectDb = require('./config/dbConnection');
const setupSwagger = require('./utils/swagger');
const index = require('./routes/index');
const {createAdmin} = require("./utils/onServerStart")
setupSwagger(app);
app.use(express.json());
app.use(bodyParser.json());
app.use(bodyParser.text({ type: 'text/plain' }));
app.use(cookieParser());
app.use(cors('*'));
app.use(helmet());
app.use(morgan('dev'));
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 1000,
  })
);
app.use(queryParser);

app.use('/api', index);
app.use('/health', (req, res) => {
  res.status(200).send({
    version: package.version,
    status: 'UP',
    msg: 'The API is up and running!',
  });
});

process.on('uncaughtException', exitHandler(1, 'Unexpected Error'));
process.on('unhandledRejection', exitHandler(1, 'Unhandled Promise'));
process.on('SIGTERM', exitHandler(0, 'SIGTERM'));
process.on('SIGINT', exitHandler(0, 'SIGINT'));
(async () => {
  await createAdmin();
})();
connectDb()
  .then(() => {
    server.listen(port, () => {
      console.log(`server is running at port ${port} `);
    });
  })
  .catch((err) => {
    console.log(`Error in Db connection ${err.message}`);
  });
