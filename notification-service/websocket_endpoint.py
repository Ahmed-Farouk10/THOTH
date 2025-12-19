from fastapi import WebSocket, WebSocketDisconnect

@app.websocket("/ws/notifications")
async def websocket_notifications(websocket: WebSocket, token: str = Query(...)):
    """WebSocket endpoint for real-time notifications."""
    user_id = None
    try:
        from platform_shared.security import verify_token
        user_data = verify_token(token)
        user_id = user_data.get("user_id")
        
        if not user_id:
            await websocket.close(code=1008)
            return
        
        await manager.connect(websocket, user_id)
        logger.info(f"WebSocket connected: {user_id}")
        
        while True:
            try:
                await websocket.receive_text()
                await websocket.send_json({"type": "pong"})
            except WebSocketDisconnect:
                break
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
    finally:
        if user_id:
            manager.disconnect(websocket, user_id)
