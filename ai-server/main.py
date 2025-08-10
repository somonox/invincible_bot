import json
import asyncio
import websockets

async def handler(websocket):
    async for message in websocket:
        state = json.loads(message)
        print("받은 상태:", state)

async def main():
    async with websockets.serve(handler, "localhost", 8000):
        print("AI 서버 실행 중...")
        await asyncio.Future()

if __name__ == "__main__":
    asyncio.run(main())
