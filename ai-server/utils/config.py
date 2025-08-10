import os
from dotenv import load_dotenv
from typing import Optional

load_dotenv()

class Config:
    def __init__(self):
        self.host: str = os.getenv("HOST", "localhost")
        self.port: int = int(os.getenv("PORT", "8000"))
        self.log_level: str = os.getenv("LOG_LEVEL", "INFO")
        self.model_path: str = os.getenv("MODEL_PATH", "models/tetris_model.pth")
        self.enable_training: bool = os.getenv("ENABLE_TRAINING", "false").lower() == "true"
        self.max_connections: int = int(os.getenv("MAX_CONNECTIONS", "10"))
        
        # AI model parameters
        self.ai_difficulty: str = os.getenv("AI_DIFFICULTY", "medium")
        self.thinking_time: float = float(os.getenv("THINKING_TIME", "0.1"))
        
        # Training parameters
        self.learning_rate: float = float(os.getenv("LEARNING_RATE", "0.0003"))
        self.batch_size: int = int(os.getenv("BATCH_SIZE", "64"))
        self.memory_size: int = int(os.getenv("MEMORY_SIZE", "100000"))
    
    def get_env_string(self, key: str, default: Optional[str] = None) -> str:
        value = os.getenv(key)
        if value is None:
            if default is not None:
                return default
            raise ValueError(f"Environment variable {key} is required")
        return value.strip()
    
    def get_env_int(self, key: str, default: Optional[int] = None) -> int:
        value = os.getenv(key)
        if value is None:
            if default is not None:
                return default
            raise ValueError(f"Environment variable {key} is required")
        try:
            return int(value)
        except ValueError:
            raise ValueError(f"Environment variable {key} must be a valid integer")
    
    def get_env_bool(self, key: str, default: Optional[bool] = None) -> bool:
        value = os.getenv(key)
        if value is None:
            if default is not None:
                return default
            raise ValueError(f"Environment variable {key} is required")
        return value.lower() in ('true', '1', 'yes', 'on')
    
    def get_env_float(self, key: str, default: Optional[float] = None) -> float:
        value = os.getenv(key)
        if value is None:
            if default is not None:
                return default
            raise ValueError(f"Environment variable {key} is required")
        try:
            return float(value)
        except ValueError:
            raise ValueError(f"Environment variable {key} must be a valid float")