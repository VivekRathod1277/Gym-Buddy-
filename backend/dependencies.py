import os
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
import jwt
from jwt.exceptions import InvalidTokenError
from backend.schemas import TokenData

# Use a default secret key for convenience or pull from environment
SECRET_KEY = os.getenv("JWT_SECRET_KEY", "super-secret-gym-buddy-key-123456789")
ALGORITHM = "HS256"

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")

def get_current_user(token: str = Depends(oauth2_scheme)) -> TokenData:
    """
    Dependency to validate the JWT token from the Authorization header
    and return the authenticated user's email and ID.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        user_id: int = payload.get("user_id")
        if email is None or user_id is None:
            raise credentials_exception
        return TokenData(email=email, user_id=user_id)
    except InvalidTokenError:
        raise credentials_exception
