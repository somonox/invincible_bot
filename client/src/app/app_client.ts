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
    private currentFrame: number = 0;
    private aiResponse: any = null;
    private isInGame: boolean = false;

    constructor(public appConfig: AppConfig) {}

    async init(url: string): Promise<void> {
        this.client = await Client.connect({
            username: this.appConfig.tetrioUsername!,
            password: this.appConfig.tetrioPassword!
        });

        console.log("Connected to TETR.IO");

        this.socket = new WebSocket(url);

        this.socket.on("open", () => {
            console.log("Connected to AI Server");
            
            const pingInterval = setInterval(() => {
                if (this.socket.readyState === WebSocket.OPEN) {
                    this.socket.send(JSON.stringify({ type: "ping" }));
                } else {
                    clearInterval(pingInterval);
                }
            }, 30000);
        });

        this.socket.on("message", (data) => {
            try {
                const response = JSON.parse(data.toString());
                if (response.type === "pong") {
                    console.log("Received pong from AI server");
                } else if (response.type === "ai_action") {
                    console.log("Received AI action:", response.data);
                    this.aiResponse = response.data;
                }
            } catch (error) {
                console.error("Error parsing message:", error);
            }
        });

        this.socket.on("close", () => {
            console.log("Disconnected from AI Server");
        });

        this.socket.on("error", (error) => {
            console.error("WebSocket error:", error);
        });

        // 게임 이벤트 리스너 설정
        this.setupGameEventListeners();
    }

    private setupGameEventListeners() {
        // 게임 시작 이벤트
        this.client.on("client.game.start", (data) => {
            console.log("Game started against:", data.players.map((p: any) => p.name).join(", "));
            this.isInGame = true;
        });

        // 라운드 시작 이벤트
        this.client.on("client.game.round.start", ([tick, engine]) => {
            console.log("Round started! Board size:", engine.board.width, "x", engine.board.height);
            this.playGame(tick, engine);
        });

        // 게임 종료 이벤트
        this.client.on("client.game.end", (data) => {
            console.log("Game ended:", data);
            this.isInGame = false;
        });

        // 게임 오버 이벤트
        this.client.on("client.game.over", (data) => {
            console.log("Game over:", data);
            this.isInGame = false;
        });

        // 채팅 이벤트
        this.client.on("room.chat", (data) => {
            console.log(`${data.user}: ${data.content}`);
            if (data.content.startsWith('!')) {
                this.handleChatCommand(data.content);
            }
        });
    }

    private handleChatCommand(command: string) {
        switch (command.toLowerCase()) {
            case '!start':
                if (!this.isInGame) {
                    this.startGame();
                }
                break;
            case '!stop':
                if (this.isInGame) {
                    this.client.room?.chat("/abort");
                }
                break;
            default:
                console.log("Unknown command:", command);
        }
    }

    async createRoom(): Promise<string> {
        const room = await this.client.rooms.create("private");
        console.log("Created room with owner:", room.owner);
        console.log("Room ID:", room.id);
        return room.id;
    }

    async joinRoom(roomId: string): Promise<any> {
        const room = await this.client.rooms.join(roomId);
        console.log("Joined room:", room.id);
        return room;
    }

    async startGame(): Promise<void> {
        const currentRoom = this.client.room;
        if (currentRoom != null) {
            console.log("Starting game in room owned by:", currentRoom.owner);
            await currentRoom.switch("player");
            await currentRoom.start();
        } else {
            console.error("Not in a room!");
        }
    }

    private playGame(tick: any, engine: any) {
        console.log("Starting gameplay loop!");
        
        const tickerCallback = async ({ gameid, frame, events, engine }: any) => {
            this.currentFrame = frame;

            // 이벤트 처리 (쓰레기 블록 등)
            for (const event of events) {
                if (event.type === "garbage") {
                    console.log("Garbage received!");
                }
            }

            // 게임 상태 생성
            const gameState = {
                board: this.convertBoardState(engine.board),
                current_piece: this.convertTetromino(engine.falling),
                next_pieces: this.convertQueue(engine.queue),
                hold_piece: engine.hold ? this.convertTetromino(engine.hold) : null,
                stats: {
                    level: engine.stats?.level || 1,
                    lines: engine.stats?.lines || 0,
                    score: engine.stats?.score || 0,
                    pps: engine.stats?.pps || 0
                },
                frame: frame
            };

            // AI 서버로 게임 상태 전송
            if (this.socket && this.socket.readyState === WebSocket.OPEN) {
                const message = {
                    type: "game_state",
                    data: gameState
                };
                this.socket.send(JSON.stringify(message));
            }

            // AI 응답이 있으면 키 입력으로 변환
            if (this.aiResponse) {
                const result = this.convertAIActionToKeys(this.aiResponse);
                this.aiResponse = null; // 응답 사용 후 초기화
                return result;
            }

            return { keys: [] };
        };

        tick(tickerCallback);
    }

    private convertBoardState(board: any) {
        // 보드 상태를 2D 배열로 변환
        if (!board || !board.state) return [];
        
        return board.state.map((row: any[]) => 
            row.map((cell: any) => cell ? cell.symbol || 1 : 0)
        );
    }

    private convertTetromino(tetromino: any) {
        if (!tetromino) return null;
        
        return {
            type: tetromino.symbol || tetromino.type,
            x: tetromino.x || 0,
            y: tetromino.y || 0,
            rotation: tetromino.rotation || 0,
            location: tetromino.location || [tetromino.x || 0, tetromino.y || 0]
        };
    }

    private convertQueue(queue: any) {
        if (!queue || !queue.queue) return [];
        
        return queue.queue.slice(0, 5).map((piece: any) => ({
            type: piece.symbol || piece.type || piece
        }));
    }

    private convertAIActionToKeys(aiAction: any) {
        const keys = [];
        const frame = this.currentFrame;

        if (!aiAction || !aiAction.action_type) {
            return { keys: [] };
        }

        switch (aiAction.action_type) {
            case 'left':
                keys.push({
                    frame,
                    type: 'keydown',
                    data: { key: 'moveLeft', subframe: 0 }
                });
                keys.push({
                    frame,
                    type: 'keyup',
                    data: { key: 'moveLeft', subframe: 0.1 }
                });
                break;
                
            case 'right':
                keys.push({
                    frame,
                    type: 'keydown',
                    data: { key: 'moveRight', subframe: 0 }
                });
                keys.push({
                    frame,
                    type: 'keyup',
                    data: { key: 'moveRight', subframe: 0.1 }
                });
                break;
                
            case 'rotate_cw':
                keys.push({
                    frame,
                    type: 'keydown',
                    data: { key: 'rotateCW', subframe: 0 }
                });
                keys.push({
                    frame,
                    type: 'keyup',
                    data: { key: 'rotateCW', subframe: 0.1 }
                });
                break;
                
            case 'rotate_ccw':
                keys.push({
                    frame,
                    type: 'keydown',
                    data: { key: 'rotateCCW', subframe: 0 }
                });
                keys.push({
                    frame,
                    type: 'keyup',
                    data: { key: 'rotateCCW', subframe: 0.1 }
                });
                break;
                
            case 'hard_drop':
                keys.push({
                    frame,
                    type: 'keydown',
                    data: { key: 'hardDrop', subframe: 0 }
                });
                keys.push({
                    frame,
                    type: 'keyup',
                    data: { key: 'hardDrop', subframe: 0.1 }
                });
                break;
                
            case 'soft_drop':
                keys.push({
                    frame,
                    type: 'keydown',
                    data: { key: 'softDrop', subframe: 0 }
                });
                // 소프트 드롭은 계속 누르고 있을 수 있음
                break;
                
            case 'hold':
                keys.push({
                    frame,
                    type: 'keydown',
                    data: { key: 'hold', subframe: 0 }
                });
                keys.push({
                    frame,
                    type: 'keyup',
                    data: { key: 'hold', subframe: 0.1 }
                });
                break;
                
            case 'wait':
            case 'none':
                // 아무것도 하지 않음
                break;
                
            default:
                console.warn("Unknown AI action:", aiAction.action_type);
        }

        return { keys };
    }

    async waitForCommands(): Promise<void> {
        console.log("Bot is ready and waiting for chat commands...");
        console.log("Available commands: !start, !stop");
        // 이벤트 리스너들은 이미 setupGameEventListeners에서 설정됨
    }

    async sendChatMessage(message: string, pinned: boolean = false): Promise<void> {
        if (this.client.room) {
            await this.client.room.chat(message, pinned);
        }
    }

    async disconnectClient(): Promise<any> {
        console.log("Disconnecting from TETR.IO...");
        if (this.socket) {
            this.socket.close();
        }
        await this.client.destroy();
        return await this.client.disconnected;
    }
}

// 사용 예제
export async function createBot(username: string, password: string, aiServerUrl: string): Promise<AppClient> {
    const config = new AppConfig(username, password);
    const bot = new AppClient(config);
    
    await bot.init(aiServerUrl);
    
    // 방 생성 또는 참가
    const roomId = await bot.createRoom();
    console.log(`Bot created room: ${roomId}`);
    
    // 명령어 대기
    await bot.waitForCommands();
    
    return bot;
}