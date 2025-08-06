import triangle from '@haelp/teto';
import dotenv from 'dotenv';
import { EnvParser } from './utils/env_parser.js';

dotenv.config();

export const config = {
    tetrio: {
        tetrioUsername: EnvParser.getString('TET_USERNAME'),
        tetrioPassword: EnvParser.getString('TET_PASSWORD')
    }
}

const client = triangle.Client.connect({
    username: config.tetrio.tetrioUsername,
    password: config.tetrio.tetrioPassword
})