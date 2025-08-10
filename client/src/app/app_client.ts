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
    private socket!: WebSocket;


    constructor(public appConfig: AppConfig) {}

    async init(url: string) {
        this.client = await Client.connect({
            username: this.appConfig.tetrioUsername!,
            password: this.appConfig.tetrioPassword!
        });

        this.socket = new WebSocket(url)

        this.socket.on("open", () => {
            console.log("Connected to AI Server")
            //this.socket.send(JSON.stringify("Good connection"))
        });
    }

    async createRoom() {
        const room = await this.client.rooms.create("private");
        console.log(room.owner)
        return room.id;
    }

    async startGame() {
        const current_room = this.client.room;
        if (current_room != null) {
            console.log(current_room.owner)
            await this.client.room?.switch("player");
            current_room.start();
        }
    }
    private async playGame() {
        console.log("Play game!")
        const [tick, engine] = await this.client.wait("client.game.round.start");
        tick(async (data) => {
        if (data.frame % 10 === 9) {
            console.log("piece dropped!")
            return {
            keys: [
                {
                frame: data.frame,
                type: "keydown",
                data: {
                    key: "hardDrop",
                    subframe: 0
                }
                },
                {
                frame: data.frame,
                type: "keyup",
                data: {
                    key: "hardDrop",
                    subframe: 0
                }
                }
            ]
            };
        }
        return {};
        });
        await this.client.wait("game.end");
        console.log("Game ended!")
    }

    async waitForStart() {
        this.client.on("room.chat", (data) => {
            console.log(data.content)
            if (data.content[0] != '!')
                return
            
            if (data.content == '!start')
                this.startGame()
            this.playGame()
         })
    }

    async disconnectClient() {
        await this.client.destroy();
        return await this.client.disconnected;
    }
}

