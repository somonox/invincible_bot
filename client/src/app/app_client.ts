// Higher Wrapper of triangle.js aka teto
import WebSocket from 'ws';
import { Client } from '@haelp/teto';

(globalThis as any).WebSocket = WebSocket;

export class AppConfig {
    constructor(
        public readonly tetrioUsername: string,
        public readonly tetrioPassword: string
    ) {}
}

export class AppClient {
    private client!: Client;
    
    constructor(public appConfig: AppConfig) {}

    async init() {
        this.client = await Client.connect({
            username: this.appConfig.tetrioUsername!,
            password: this.appConfig.tetrioPassword!
        });
    }

    async createRoom() {
        const room = await this.client.rooms.create("private");
        return room.id;
    }

    async disconnectClient() {
        await this.client.destroy();
        return await this.client.disconnected;
    }
}

