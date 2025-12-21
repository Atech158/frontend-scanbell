from fastapi import FastAPI, APIRouter, HTTPException, Request, Response, Depends
from fastapi.responses import JSONResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional
import uuid
from datetime import datetime, timezone, time
import httpx
import asyncio

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# Configure logging early
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ.get('DB_NAME', 'scanbell_db')]

# Environment / auth config
ENVIRONMENT = os.environ.get("ENV", "local")  # "local" or "prod"
AUTH_URL = os.environ.get("AUTH_URL", "https://auth.emergentagent.com")
AUTH_SESSION_URL = os.environ.get(
    "AUTH_SESSION_URL",
    "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
)

# OneSignal Configuration
ONESIGNAL_APP_ID = os.environ.get("ONESIGNAL_APP_ID", "d973b242-942f-4bce-8fc2-4690cca583ed")
ONESIGNAL_API_KEY = os.environ.get("ONESIGNAL_API_KEY", "")

app = FastAPI(title="ScanBell API")
api_router = APIRouter(prefix="/api")

# ==================== MODELS ====================

class User(BaseModel):
    model_config = ConfigDict(extra="ignore", populate_by_name=True)
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    email: str
    name: str
    picture: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class UserSession(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    session_token: str
    expires_at: datetime
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class DoorbellSettings(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    display_name: str = "My Doorbell"
    call_link: str = ""
    availability_enabled: bool = False
    availability_start: str = "09:00"
    availability_end: str = "21:00"
    blocked_ips: List[str] = Field(default_factory=list)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class QRCodeSettings(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    frame_color: str = "#0D9488"
    instruction_text: str = "Scan to Ring"
    logo_url: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class CallHistory(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    visitor_name: Optional[str] = None
    visitor_ip: Optional[str] = None
    status: str = "missed"  # missed, answered, blocked
    duration_seconds: int = 0
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class UserFCMToken(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    token: str
    platform: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class SignalingMessage(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    room_id: str
    sender_type: str  # visitor or owner
    message_type: str  # offer, answer, ice-candidate, ring, accept, reject, end
    payload: dict = Field(default_factory=dict)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    processed: bool = False

# ==================== AUTH HELPERS ====================

async def get_current_user(request: Request) -> Optional[User]:
    """Extract user from session token in cookie or header"""
    session_token = request.cookies.get("session_token")
    if not session_token:
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            session_token = auth_header.split(" ")[1]
    
    if not session_token:
        return None
    
    session = await db.user_sessions.find_one({
        "session_token": session_token,
        "expires_at": {"$gt": datetime.now(timezone.utc)}
    })
    
    if not session:
        return None
    
    user = await db.users.find_one({"id": session["user_id"]})
    if user:
        return User(**user)
    return None

async def require_auth(request: Request) -> User:
    """Require authentication for endpoint"""
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return user


# ==================== NOTIFICATION HELPERS ====================

async def send_doorbell_notification(user_id: str, visitor_name: str, call_id: str) -> None:
    """Send a OneSignal push notification to all devices of the user."""
    if not ONESIGNAL_API_KEY:
        logger.warning("OneSignal API Key not found; skipping notification.")
        return

    logger.info(f"Preparing to send OneSignal notification for user_id={user_id}, call_id={call_id}")

    tokens_cursor = db.user_fcm_tokens.find({"user_id": user_id})
    tokens_docs = await tokens_cursor.to_list(100)
    subscription_ids = [doc["token"] for doc in tokens_docs if doc.get("token")]

    if not subscription_ids:
        logger.info(f"No notification tokens found for user {user_id}; skipping notification.")
        return

    title = "Someone is at your door"
    body = f"{visitor_name} is ringing your ScanBell"

    url = "https://onesignal.com/api/v1/notifications"
    headers = {
        "Content-Type": "application/json; charset=utf-8",
        "Authorization": f"Basic {ONESIGNAL_API_KEY}"
    }

    payload = {
        "app_id": ONESIGNAL_APP_ID,
        "include_subscription_ids": subscription_ids,
        "headings": {"en": title},
        "contents": {"en": body},
        "data": {
            "type": "doorbell_ring",
            "call_id": call_id,
            "visitor_name": visitor_name
        },
        "buttons": [{"id": "view", "text": "View"}]
    }

    async with httpx.AsyncClient() as client:
        try:
            response = await client.post(url, json=payload, headers=headers)
            if response.status_code == 200:
                logger.info(f"Sent OneSignal notification to user {user_id}. Response: {response.json()}")
            else:
                logger.error(f"Failed to send OneSignal notification: {response.text}")
        except Exception as e:
            logger.error(f"Error sending OneSignal notification: {e}")

# ==================== AUTH ROUTES ====================

@api_router.post("/auth/session")
async def create_session(request: Request, response: Response):
    """Exchange session_id for session_token"""
    body = await request.json()
    session_id = body.get("session_id")
    
    if not session_id:
        raise HTTPException(status_code=400, detail="session_id required")
    
    async with httpx.AsyncClient() as client:
        try:
            resp = await client.get(
                AUTH_SESSION_URL,
                headers={"X-Session-ID": session_id}
            )
            if resp.status_code != 200:
                raise HTTPException(status_code=401, detail="Invalid session")
            
            data = resp.json()
        except Exception as e:
            logger.error(f"Auth error: {e}")
            raise HTTPException(status_code=500, detail="Auth service error")
    
    # Check if user exists
    existing_user = await db.users.find_one({"email": data["email"]})
    
    if existing_user:
        user_id = existing_user["id"]
    else:
        # Create new user
        user = User(
            email=data["email"],
            name=data["name"],
            picture=data.get("picture")
        )
        user_dict = user.model_dump()
        user_dict["created_at"] = user_dict["created_at"].isoformat()
        await db.users.insert_one(user_dict)
        user_id = user.id
        
        # Create default doorbell settings
        doorbell = DoorbellSettings(
            user_id=user_id,
            call_link=f"/call/{user_id}"
        )
        doorbell_dict = doorbell.model_dump()
        doorbell_dict["created_at"] = doorbell_dict["created_at"].isoformat()
        doorbell_dict["updated_at"] = doorbell_dict["updated_at"].isoformat()
        await db.doorbell_settings.insert_one(doorbell_dict)
        
        # Create default QR settings
        qr = QRCodeSettings(user_id=user_id)
        qr_dict = qr.model_dump()
        qr_dict["created_at"] = qr_dict["created_at"].isoformat()
        qr_dict["updated_at"] = qr_dict["updated_at"].isoformat()
        await db.qr_settings.insert_one(qr_dict)
    
    # Check FCM token presence for this user
    # fcm_token_count = await db.user_fcm_tokens.count_documents({"user_id": user_id})
    # needs_fcm_token = fcm_token_count == 0
    needs_fcm_token = False
    
    # Create session
    session_token = data.get("session_token", str(uuid.uuid4()))
    session = UserSession(
        user_id=user_id,
        session_token=session_token,
        expires_at=datetime.now(timezone.utc).replace(day=datetime.now(timezone.utc).day + 7)
    )
    session_dict = session.model_dump()
    session_dict["expires_at"] = session_dict["expires_at"]
    session_dict["created_at"] = session_dict["created_at"].isoformat()
    await db.user_sessions.insert_one(session_dict)
    
    # Set cookie
    # For local development over http://localhost, secure cookies with SameSite=None
    # will not be sent by the browser. Relax settings when ENV=local.
    cookie_secure = ENVIRONMENT != "local"
    cookie_samesite = "lax" if ENVIRONMENT == "local" else "none"

    response.set_cookie(
        key="session_token",
        value=session_token,
        httponly=True,
        secure=cookie_secure,
        samesite=cookie_samesite,
        path="/",
        max_age=7 * 24 * 60 * 60,
    )
    
    user_data = await db.users.find_one({"id": user_id}, {"_id": 0})
    return {
        "user": user_data,
        "session_token": session_token,
        "needs_fcm_token": needs_fcm_token,
    }

@api_router.get("/auth/me")
async def get_me(request: Request):
    """Get current user"""
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return user.model_dump()

@api_router.post("/auth/logout")
async def logout(request: Request, response: Response):
    """Logout user"""
    session_token = request.cookies.get("session_token")
    if session_token:
        await db.user_sessions.delete_many({"session_token": session_token})
    
    response.delete_cookie(key="session_token", path="/")
    return {"message": "Logged out"}

# ==================== DOORBELL ROUTES ====================

@api_router.get("/doorbell/settings")
async def get_doorbell_settings(user: User = Depends(require_auth)):
    """Get user's doorbell settings"""
    settings = await db.doorbell_settings.find_one({"user_id": user.id}, {"_id": 0})
    if not settings:
        # Create default
        doorbell = DoorbellSettings(user_id=user.id, call_link=f"/call/{user.id}")
        doorbell_dict = doorbell.model_dump()
        doorbell_dict["created_at"] = doorbell_dict["created_at"].isoformat()
        doorbell_dict["updated_at"] = doorbell_dict["updated_at"].isoformat()
        await db.doorbell_settings.insert_one(doorbell_dict)
        settings = doorbell_dict
    return settings

@api_router.put("/doorbell/settings")
async def update_doorbell_settings(request: Request, user: User = Depends(require_auth)):
    """Update doorbell settings"""
    body = await request.json()
    update_data = {
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    allowed_fields = ["display_name", "availability_enabled", "availability_start", "availability_end"]
    for field in allowed_fields:
        if field in body:
            update_data[field] = body[field]
    
    await db.doorbell_settings.update_one(
        {"user_id": user.id},
        {"$set": update_data}
    )
    
    return await db.doorbell_settings.find_one({"user_id": user.id}, {"_id": 0})

@api_router.post("/doorbell/block")
async def block_ip(request: Request, user: User = Depends(require_auth)):
    """Block an IP address"""
    body = await request.json()
    ip = body.get("ip")
    if not ip:
        raise HTTPException(status_code=400, detail="IP required")
    
    await db.doorbell_settings.update_one(
        {"user_id": user.id},
        {"$addToSet": {"blocked_ips": ip}}
    )
    return {"message": "IP blocked"}

@api_router.post("/doorbell/unblock")
async def unblock_ip(request: Request, user: User = Depends(require_auth)):
    """Unblock an IP address"""
    body = await request.json()
    ip = body.get("ip")
    if not ip:
        raise HTTPException(status_code=400, detail="IP required")
    
    await db.doorbell_settings.update_one(
        {"user_id": user.id},
        {"$pull": {"blocked_ips": ip}}
    )
    return {"message": "IP unblocked"}


# ==================== NOTIFICATION ROUTES ====================

@api_router.post("/notifications/register-token")
async def register_fcm_token(request: Request, user: User = Depends(require_auth)):
    """
    Register or update the FCM token for the current user.
    Frontend should call this after getting notification permission and an FCM token.
    """
    body = await request.json()
    token = body.get("token")
    platform = body.get("platform")

    if not token:
        raise HTTPException(status_code=400, detail="token is required")

    logger.info(f"Registering FCM token for user_id={user.id}")

    # Upsert token document
    now = datetime.now(timezone.utc)
    await db.user_fcm_tokens.update_one(
        {"user_id": user.id, "token": token},
        {
            "$set": {
                "user_id": user.id,
                "token": token,
                "platform": platform,
                "updated_at": now.isoformat(),
            },
            "$setOnInsert": {
                "id": str(uuid.uuid4()),
                "created_at": now.isoformat(),
            },
        },
        upsert=True,
    )

    return {"message": "FCM token registered"}

@api_router.post("/doorbell/regenerate-link")
async def regenerate_link(user: User = Depends(require_auth)):
    """Regenerate call link"""
    new_link_id = str(uuid.uuid4())[:8]
    new_link = f"/call/{user.id}-{new_link_id}"
    
    await db.doorbell_settings.update_one(
        {"user_id": user.id},
        {"$set": {"call_link": new_link, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    return {"call_link": new_link}

# ==================== QR CODE ROUTES ====================

@api_router.get("/qr/settings")
async def get_qr_settings(user: User = Depends(require_auth)):
    """Get QR code settings"""
    settings = await db.qr_settings.find_one({"user_id": user.id}, {"_id": 0})
    if not settings:
        qr = QRCodeSettings(user_id=user.id)
        qr_dict = qr.model_dump()
        qr_dict["created_at"] = qr_dict["created_at"].isoformat()
        qr_dict["updated_at"] = qr_dict["updated_at"].isoformat()
        await db.qr_settings.insert_one(qr_dict)
        settings = qr_dict
    return settings

@api_router.put("/qr/settings")
async def update_qr_settings(request: Request, user: User = Depends(require_auth)):
    """Update QR code settings"""
    body = await request.json()
    update_data = {"updated_at": datetime.now(timezone.utc).isoformat()}
    
    allowed_fields = ["frame_color", "instruction_text", "logo_url"]
    for field in allowed_fields:
        if field in body:
            update_data[field] = body[field]
    
    await db.qr_settings.update_one(
        {"user_id": user.id},
        {"$set": update_data}
    )
    
    return await db.qr_settings.find_one({"user_id": user.id}, {"_id": 0})

# ==================== CALL HISTORY ROUTES ====================

@api_router.get("/calls/history")
async def get_call_history(user: User = Depends(require_auth)):
    """Get call history"""
    calls = await db.call_history.find(
        {"user_id": user.id},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    return calls

@api_router.delete("/calls/{call_id}")
async def delete_call(call_id: str, user: User = Depends(require_auth)):
    """Delete a call from history"""
    result = await db.call_history.delete_one({"id": call_id, "user_id": user.id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Call not found")
    return {"message": "Call deleted"}

@api_router.get("/calls/stats")
async def get_call_stats(user: User = Depends(require_auth)):
    """Get call statistics"""
    total = await db.call_history.count_documents({"user_id": user.id})
    answered = await db.call_history.count_documents({"user_id": user.id, "status": "answered"})
    missed = await db.call_history.count_documents({"user_id": user.id, "status": "missed"})
    blocked = await db.call_history.count_documents({"user_id": user.id, "status": "blocked"})
    
    return {
        "total": total,
        "answered": answered,
        "missed": missed,
        "blocked": blocked
    }

# ==================== SIGNALING ROUTES (WebRTC) ====================

@api_router.get("/call/info/{user_id}")
async def get_call_info(user_id: str, request: Request):
    """Get doorbell info for visitor (public)"""
    # Handle user_id with optional suffix
    base_user_id = user_id.split("-")[0] if "-" in user_id and len(user_id) > 36 else user_id
    
    settings = await db.doorbell_settings.find_one({"user_id": base_user_id})
    if not settings:
        raise HTTPException(status_code=404, detail="Doorbell not found")
    
    # Check if visitor is blocked
    visitor_ip = request.client.host if request.client else "unknown"
    if visitor_ip in settings.get("blocked_ips", []):
        raise HTTPException(status_code=403, detail="You have been blocked")
    
    # Check availability
    if settings.get("availability_enabled"):
        now = datetime.now(timezone.utc)
        start_time = datetime.strptime(settings.get("availability_start", "09:00"), "%H:%M").time()
        end_time = datetime.strptime(settings.get("availability_end", "21:00"), "%H:%M").time()
        current_time = now.time()
        
        if not (start_time <= current_time <= end_time):
            return {
                "display_name": settings.get("display_name"),
                "available": False,
                "message": f"Available between {settings.get('availability_start')} - {settings.get('availability_end')}"
            }
    
    user = await db.users.find_one({"id": base_user_id})
    
    return {
        "display_name": settings.get("display_name"),
        "owner_name": user.get("name") if user else "Unknown",
        "available": True
    }

@api_router.post("/signaling/send")
async def send_signal(request: Request):
    """Send a signaling message"""
    body = await request.json()
    room_id = body.get("room_id")
    sender_type = body.get("sender_type")
    message_type = body.get("message_type")
    payload = body.get("payload", {})
    
    if not all([room_id, sender_type, message_type]):
        raise HTTPException(status_code=400, detail="Missing required fields")
    
    # Extract base user_id from room_id
    base_user_id = room_id.split("-")[0] if "-" in room_id and len(room_id) > 36 else room_id
    
    # If visitor is ringing, create call history
    if message_type == "ring" and sender_type == "visitor":
        logger.info(f"Received ring message for room_id={room_id}, base_user_id={base_user_id}")
        visitor_ip = request.client.host if request.client else "unknown"
        
        # Check if blocked
        settings = await db.doorbell_settings.find_one({"user_id": base_user_id})
        if settings and visitor_ip in settings.get("blocked_ips", []):
            raise HTTPException(status_code=403, detail="You have been blocked")
        
        call = CallHistory(
            user_id=base_user_id,
            visitor_name=payload.get("visitor_name", "Unknown Visitor"),
            visitor_ip=visitor_ip,
            status="missed"
        )
        call_dict = call.model_dump()
        call_dict["created_at"] = call_dict["created_at"].isoformat()
        await db.call_history.insert_one(call_dict)
        payload["call_id"] = call.id

        # Send FCM notification to the doorbell owner
        await send_doorbell_notification(
            user_id=base_user_id,
            visitor_name=payload.get("visitor_name", "Unknown Visitor"),
            call_id=call.id,
        )
    
    message = SignalingMessage(
        room_id=room_id,
        sender_type=sender_type,
        message_type=message_type,
        payload=payload
    )
    msg_dict = message.model_dump()
    msg_dict["created_at"] = msg_dict["created_at"].isoformat()
    await db.signaling.insert_one(msg_dict)
    
    # If call is answered, update call history
    if message_type == "accept" and sender_type == "owner":
        call_id = payload.get("call_id")
        if call_id:
            await db.call_history.update_one(
                {"id": call_id},
                {"$set": {"status": "answered"}}
            )
    
    return {"message_id": message.id}

@api_router.get("/signaling/poll/{room_id}")
async def poll_signals(room_id: str, sender_type: str, last_id: Optional[str] = None):
    """Poll for new signaling messages"""
    # Get messages for the opposite sender type
    target_sender = "owner" if sender_type == "visitor" else "visitor"
    
    query = {
        "room_id": room_id,
        "sender_type": target_sender,
        "processed": False
    }
    
    messages = await db.signaling.find(query, {"_id": 0}).sort("created_at", 1).to_list(50)
    
    # Mark as processed
    if messages:
        message_ids = [m["id"] for m in messages]
        await db.signaling.update_many(
            {"id": {"$in": message_ids}},
            {"$set": {"processed": True}}
        )
    
    return {"messages": messages}

@api_router.post("/signaling/end-call")
async def end_call(request: Request):
    """End a call and update duration"""
    body = await request.json()
    call_id = body.get("call_id")
    duration = body.get("duration_seconds", 0)
    
    if call_id:
        await db.call_history.update_one(
            {"id": call_id},
            {"$set": {"duration_seconds": duration}}
        )
    
    return {"message": "Call ended"}

# ==================== HEALTH CHECK ====================

@api_router.get("/")
async def root():
    return {"message": "ScanBell API", "status": "healthy"}

@api_router.get("/health")
async def health():
    return {"status": "healthy"}

# Include router
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
