#!/usr/bin/env python3
import asyncio
import logging
import json
from typing import Dict, List, Optional
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from pydantic import BaseModel
import uvicorn
from utils.logger import setup_logger
from utils.config import Config
from ai_models.tetris_ai import TetrisAI

app = FastAPI(title="TETR.IO AI Server", version="1.0.0")
logger = setup_logger(__name__)

class GameState(BaseModel):
    board: List[List[int]]
    current_piece: Optional[Dict]
    next_pieces: List[Dict]
    hold_piece: Optional[Dict]
    stats: Dict

class AIAction(BaseModel):
    action_type: str
    parameters: Dict

class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []
    
    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
        logger.info(f"Client connected. Total connections: {len(self.active_connections)}")
    
    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
        logger.info(f"Client disconnected. Total connections: {len(self.active_connections)}")
    
    async def send_personal_message(self, message: str, websocket: WebSocket):
        await websocket.send_text(message)

manager = ConnectionManager()
tetris_ai = TetrisAI()

@app.get("/")
async def root():
    return {"message": "TETR.IO AI Server is running"}

@app.get("/health")
async def health_check():
    return {"status": "healthy", "model_loaded": tetris_ai.is_loaded()}

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            data = await websocket.receive_text()
            try:
                message = json.loads(data)
                
                if message.get("type") == "game_state":
                    game_state = GameState(**message.get("data", {}))
                    action = await tetris_ai.get_action(game_state)
                    
                    if isinstance(action, BaseModel):
                        action_data = action.dict()
                    else:
                        action_data = action

                    response = {
                        "type": "ai_action",
                        "data": action_data
                    }

                    
                    await manager.send_personal_message(
                        json.dumps(response), websocket
                    )
                
                elif message.get("type") == "ping":
                    await manager.send_personal_message(
                        json.dumps({"type": "pong"}), websocket
                    )
                
                else:
                    logger.warning(f"Unknown message type: {message.get('type')}")
                    
            except json.JSONDecodeError:
                logger.error(f"Invalid JSON received: {data}")
            except Exception as e:
                logger.error(f"Error processing message: {e}")
                
    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        manager.disconnect(websocket)

if __name__ == "__main__":
    config = Config()
    logger.info("Starting TETR.IO AI Server...")
    logger.info(f"Server will run on {config.host}:{config.port}")
    
    uvicorn.run(
        app,
        host=config.host,
        port=config.port,
        log_level=config.log_level.lower()
    )