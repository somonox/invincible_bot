import dotenv from 'dotenv';
import { EnvParser } from './utils/env_parser.js';
import { createBot, AppConfig } from './app/app_client.js';

dotenv.config();

// TODO: Implement config validater
export const config = new AppConfig (
    EnvParser.getString('TET_USERNAME'),
    EnvParser.getString('TET_PASSWORD')
)

async function main() {
    const bot = await createBot(config.tetrioUsername, config.tetrioPassword, "ws://127.0.0.1:8000/ws");
}

main();