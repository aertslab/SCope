import hashlib
import json
import random
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from app.api.deps import get_db
from app.models.session import Session
from app.schemas.session import SessionCreate, Session as SessionSchema
import uuid
import secrets

router = APIRouter()

def generate_deterministic_id(data: dict, length=8, attempt=0):
    # Create a stable string representation of the data
    data_str = json.dumps(data, sort_keys=True)
    if attempt > 0:
        data_str += f":{attempt}"
    
    # Create a seed from the data hash
    seed_str = hashlib.sha256(data_str.encode()).hexdigest()
    
    # Use a local random instance to avoid affecting global state
    rng = random.Random(seed_str)
    
    alphabet = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
    return ''.join(rng.choice(alphabet) for _ in range(length))

@router.post("/", response_model=SessionSchema)
async def create_session(
    session_in: SessionCreate,
    db: AsyncSession = Depends(get_db)
):
    # Try to generate a deterministic ID
    # We loop to handle collisions where the content is different
    for attempt in range(10):
        short_id = generate_deterministic_id(session_in.data, attempt=attempt)
        existing = await db.get(Session, short_id)
        
        if existing:
            # If ID exists, check if content matches
            if existing.data == session_in.data:
                return existing
            
            # If content doesn't match, it's a collision. 
            # Continue to next attempt (which will modify the input to hash)
            continue
        else:
            # ID doesn't exist, create new session
            db_session = Session(
                id=short_id,
                data=session_in.data
            )
            db.add(db_session)
            await db.commit()
            await db.refresh(db_session)
            return db_session
            
    # Fallback to UUID if collision loop fails
    db_session = Session(
        id=str(uuid.uuid4()),
        data=session_in.data
    )
    db.add(db_session)
    await db.commit()
    await db.refresh(db_session)
    return db_session

@router.get("/{session_id}", response_model=SessionSchema)
async def get_session(
    session_id: str,
    db: AsyncSession = Depends(get_db)
):
    session = await db.get(Session, session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return session
