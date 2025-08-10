import numpy as np
import torch
import torch.nn as nn
import torch.optim as optim
from typing import Dict, List, Optional, Tuple
import random
import json
from collections import deque
from utils.logger import setup_logger
from utils.config import Config

logger = setup_logger(__name__)

class TetrisNet(nn.Module):
    def __init__(self, input_size: int = 410, hidden_size: int = 512, output_size: int = 7):
        super(TetrisNet, self).__init__()
        self.fc1 = nn.Linear(input_size, hidden_size)
        self.fc2 = nn.Linear(hidden_size, hidden_size)
        self.fc3 = nn.Linear(hidden_size, hidden_size // 2)
        self.fc4 = nn.Linear(hidden_size // 2, output_size)
        self.dropout = nn.Dropout(0.3)
        self.relu = nn.ReLU()
    
    def forward(self, x):
        x = self.relu(self.fc1(x))
        x = self.dropout(x)
        x = self.relu(self.fc2(x))
        x = self.dropout(x)
        x = self.relu(self.fc3(x))
        x = self.fc4(x)
        return x

class TetrisAI:
    def __init__(self):
        self.config = Config()
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        self.model = TetrisNet().to(self.device)
        self.optimizer = optim.Adam(self.model.parameters(), lr=self.config.learning_rate)
        self.memory = deque(maxlen=self.config.memory_size)
        self.epsilon = 0.9
        self.epsilon_decay = 0.995
        self.epsilon_min = 0.01
        self.model_loaded = False
        
        # Tetris piece definitions
        self.pieces = {
            'I': [[1,1,1,1]],
            'O': [[1,1],[1,1]],
            'T': [[0,1,0],[1,1,1]],
            'S': [[0,1,1],[1,1,0]],
            'Z': [[1,1,0],[0,1,1]],
            'J': [[1,0,0],[1,1,1]],
            'L': [[0,0,1],[1,1,1]]
        }
        
        # Actions: left, right, rotate_cw, rotate_ccw, soft_drop, hard_drop, hold
        self.actions = ['left', 'right', 'rotate_cw', 'rotate_ccw', 'soft_drop', 'hard_drop', 'hold']
        
        self.load_model()
    
    def load_model(self):
        try:
            checkpoint = torch.load(self.config.model_path, map_location=self.device)
            self.model.load_state_dict(checkpoint['model_state_dict'])
            self.optimizer.load_state_dict(checkpoint['optimizer_state_dict'])
            self.epsilon = checkpoint.get('epsilon', self.epsilon)
            logger.info(f"Model loaded from {self.config.model_path}")
            self.model_loaded = True
        except FileNotFoundError:
            logger.info("No pre-trained model found. Starting with random weights.")
            self.model_loaded = False
        except Exception as e:
            logger.error(f"Error loading model: {e}")
            self.model_loaded = False
    
    def save_model(self):
        try:
            checkpoint = {
                'model_state_dict': self.model.state_dict(),
                'optimizer_state_dict': self.optimizer.state_dict(),
                'epsilon': self.epsilon
            }
            torch.save(checkpoint, self.config.model_path)
            logger.info(f"Model saved to {self.config.model_path}")
        except Exception as e:
            logger.error(f"Error saving model: {e}")
    
    def is_loaded(self) -> bool:
        return self.model_loaded
    
    def encode_board(self, board: List[List[int]]) -> List[float]:
        flattened = []
        for row in board:
            flattened.extend(row)
        return flattened
    
    def encode_piece(self, piece: Optional[Dict]) -> List[float]:
        if not piece:
            return [0] * 10
        
        piece_type = piece.get('type', 'I')
        x = piece.get('x', 0)
        y = piece.get('y', 0)
        rotation = piece.get('rotation', 0)
        
        piece_encoding = [0] * 7
        if piece_type in ['I', 'O', 'T', 'S', 'Z', 'J', 'L']:
            piece_encoding[['I', 'O', 'T', 'S', 'Z', 'J', 'L'].index(piece_type)] = 1
        
        return piece_encoding + [x/10.0, y/20.0, rotation/4.0]
    
    def encode_game_state(self, game_state) -> np.ndarray:
        features = []
        
        # Board state (20x10 = 200 features)
        board_features = self.encode_board(game_state.board)
        features.extend(board_features)
        
        # Current piece (10 features)
        current_piece_features = self.encode_piece(game_state.current_piece)
        features.extend(current_piece_features)
        
        return np.array(features, dtype=np.float32)
    
    async def get_action(self, game_state) -> Dict:
        try:
            state_vector = self.encode_game_state(game_state)
            
            if np.random.random() < self.epsilon:
                action_idx = random.randint(0, len(self.actions) - 1)
            else:
                state_tensor = torch.FloatTensor(state_vector).unsqueeze(0).to(self.device)
                with torch.no_grad():
                    q_values = self.model(state_tensor)
                    action_idx = q_values.argmax().item()
            
            action_type = self.actions[action_idx]
            
            # Determine action parameters based on type
            parameters = {}
            if action_type in ['left', 'right']:
                parameters = {'direction': action_type}
            elif action_type.startswith('rotate'):
                parameters = {'rotation': 'clockwise' if action_type == 'rotate_cw' else 'counterclockwise'}
            elif action_type in ['soft_drop', 'hard_drop']:
                parameters = {'drop_type': action_type}
            elif action_type == 'hold':
                parameters = {}
            
            return {
                'action_type': action_type,
                'parameters': parameters,
                'confidence': 1 - self.epsilon
            }
            
        except Exception as e:
            logger.error(f"Error in get_action: {e}")
            # Default action when error occurs
            return {
                'action_type': 'hard_drop',
                'parameters': {'drop_type': 'hard_drop'},
                'confidence': 0.0
            }
    
    def calculate_reward(self, old_state, new_state, action) -> float:
        reward = 0
        
        # Basic survival reward
        reward += 0.1
        
        # Line clear rewards
        old_lines = old_state.get('stats', {}).get('lines_cleared', 0)
        new_lines = new_state.get('stats', {}).get('lines_cleared', 0)
        lines_cleared = new_lines - old_lines
        
        if lines_cleared > 0:
            reward += lines_cleared * 10
            if lines_cleared == 4:  # Tetris
                reward += 20
        
        # Height penalty
        board_height = self.get_board_height(new_state.get('board', []))
        reward -= board_height * 0.1
        
        # Holes penalty
        holes = self.count_holes(new_state.get('board', []))
        reward -= holes * 2
        
        # Game over penalty
        if new_state.get('game_over', False):
            reward -= 100
        
        return reward
    
    def get_board_height(self, board: List[List[int]]) -> int:
        for i, row in enumerate(board):
            if any(cell != 0 for cell in row):
                return len(board) - i
        return 0
    
    def count_holes(self, board: List[List[int]]) -> int:
        holes = 0
        for col in range(len(board[0])):
            found_block = False
            for row in range(len(board)):
                if board[row][col] != 0:
                    found_block = True
                elif found_block and board[row][col] == 0:
                    holes += 1
        return holes
    
    def train_step(self, batch):
        if len(batch) < self.config.batch_size:
            return
        
        states = torch.FloatTensor([transition['state'] for transition in batch]).to(self.device)
        actions = torch.LongTensor([transition['action'] for transition in batch]).to(self.device)
        rewards = torch.FloatTensor([transition['reward'] for transition in batch]).to(self.device)
        next_states = torch.FloatTensor([transition['next_state'] for transition in batch]).to(self.device)
        dones = torch.BoolTensor([transition['done'] for transition in batch]).to(self.device)
        
        current_q_values = self.model(states).gather(1, actions.unsqueeze(1))
        next_q_values = self.model(next_states).max(1)[0].detach()
        target_q_values = rewards + (0.99 * next_q_values * ~dones)
        
        loss = nn.MSELoss()(current_q_values.squeeze(), target_q_values)
        
        self.optimizer.zero_grad()
        loss.backward()
        self.optimizer.step()
        
        if self.epsilon > self.epsilon_min:
            self.epsilon *= self.epsilon_decay
        
        return loss.item()