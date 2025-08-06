import dotenv from 'dotenv';
import { EnvParser } from './utils/env_parser.js';
import { AppClient, AppConfig } from './app/app_client.js';

dotenv.config();

// TODO: Implement config validater
export const config = new AppConfig (
    EnvParser.getString('TET_USERNAME'),
    EnvParser.getString('TET_PASSWORD')
)
const client = new AppClient(config);

async function main() {
    // Initialize client async is really needed because core API(triangle.js) is initialized asynchronously  
    console.log('Initilize Client with User: ' + config.tetrioUsername)
    await client.init();
    console.log('Client initialized!');
    console.log(await client.createRoom());
}

main();