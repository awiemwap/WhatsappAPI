import cors from 'cors';
import 'dotenv/config';
import express from 'express';
import routes from './routes';
import { response } from './utils';
import { init } from './whatsappInit';
// import pinoHttp from 'pino-http';

const compression = require('compression');

const app = express();

// Express configuration
app.use(cors());
app.use(compression());
// app.use(pinoHttp()); // Enable http logging later
app.use(express.json());

// Load routes
app.use('/', routes);
app.all('*', (req, res) => response(res, 404, false, 'Url not found'));

// Start server
const host = process.env.HOST || '0.0.0.0';
const port = Number(process.env.PORT || 3000);

// Initialize the app
(async () => {
    // initialize whatsapp sessions
    await init();

    app.listen(port, host, () => console.log(`Server is listening on http://${host}:${port}`));
})();
