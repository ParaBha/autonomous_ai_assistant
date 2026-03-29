from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import httpx
import os
from typing import Optional

router = APIRouter()

class OAuthCallbackRequest(BaseModel):
    code: str

# OAuth Provider Configurations
OAUTH_CONFIGS = {
    "github": {
        "token_url": "https://github.com/login/oauth/access_token",
        "user_url": "https://api.github.com/user",
        "client_id": os.getenv("GITHUB_CLIENT_ID"),
        "client_secret": os.getenv("GITHUB_CLIENT_SECRET"),
    },
    "google": {
        "token_url": "https://oauth2.googleapis.com/token",
        "user_url": "https://www.googleapis.com/oauth2/v2/userinfo",
        "client_id": os.getenv("GOOGLE_CLIENT_ID"),
        "client_secret": os.getenv("GOOGLE_CLIENT_SECRET"),
    },
    "microsoft": {
        "token_url": "https://login.microsoftonline.com/common/oauth2/v2.0/token",
        "user_url": "https://graph.microsoft.com/v1.0/me",
        "client_id": os.getenv("MICROSOFT_CLIENT_ID"),
        "client_secret": os.getenv("MICROSOFT_CLIENT_SECRET"),
    }
}

@router.post("/oauth/{provider}/callback")
async def oauth_callback(provider: str, request: OAuthCallbackRequest):
    """
    Handle OAuth callback and exchange authorization code for user data
    """
    if provider not in OAUTH_CONFIGS:
        raise HTTPException(status_code=400, detail="Invalid OAuth provider")
    
    config = OAUTH_CONFIGS[provider]
    
    # Validate configuration
    if not config["client_id"] or not config["client_secret"]:
        raise HTTPException(
            status_code=500, 
            detail=f"{provider.capitalize()} OAuth not configured. Please set environment variables."
        )
    
    try:
        # Exchange authorization code for access token
        async with httpx.AsyncClient() as client:
            token_data = {
                "client_id": config["client_id"],
                "client_secret": config["client_secret"],
                "code": request.code,
                "redirect_uri": f"{os.getenv('FRONTEND_URL', 'http://localhost:3001')}/auth/callback",
            }
            
            if provider == "github":
                token_data["grant_type"] = "authorization_code"
                headers = {"Accept": "application/json"}
            elif provider == "google":
                token_data["grant_type"] = "authorization_code"
                headers = {"Content-Type": "application/x-www-form-urlencoded"}
            else:  # microsoft
                token_data["grant_type"] = "authorization_code"
                headers = {"Content-Type": "application/x-www-form-urlencoded"}
            
            token_response = await client.post(
                config["token_url"],
                data=token_data,
                headers=headers
            )
            
            if token_response.status_code != 200:
                raise HTTPException(
                    status_code=400,
                    detail=f"Failed to exchange code for token: {token_response.text}"
                )
            
            token_json = token_response.json()
            access_token = token_json.get("access_token")
            
            if not access_token:
                raise HTTPException(status_code=400, detail="No access token received")
            
            # Fetch user information
            user_headers = {"Authorization": f"Bearer {access_token}"}
            user_response = await client.get(config["user_url"], headers=user_headers)
            
            if user_response.status_code != 200:
                raise HTTPException(
                    status_code=400,
                    detail=f"Failed to fetch user data: {user_response.text}"
                )
            
            user_data = user_response.json()
            
            # Normalize user data across providers
            if provider == "github":
                normalized_user = {
                    "name": user_data.get("name") or user_data.get("login"),
                    "email": user_data.get("email"),
                    "avatar": user_data.get("avatar_url"),
                    "profession": user_data.get("bio") or "Developer",
                    "phone": "+1 (555) 000-0000",
                    "authProvider": "github"
                }
            elif provider == "google":
                normalized_user = {
                    "name": user_data.get("name"),
                    "email": user_data.get("email"),
                    "avatar": user_data.get("picture"),
                    "profession": "Research Scientist",
                    "phone": "+1 (555) 000-0000",
                    "authProvider": "google"
                }
            else:  # microsoft
                normalized_user = {
                    "name": user_data.get("displayName"),
                    "email": user_data.get("mail") or user_data.get("userPrincipalName"),
                    "avatar": f"https://api.dicebear.com/7.x/avataaars/svg?seed={user_data.get('id')}",
                    "profession": user_data.get("jobTitle") or "Professional",
                    "phone": user_data.get("mobilePhone") or "+1 (555) 000-0000",
                    "authProvider": "microsoft"
                }
            
            return normalized_user
            
    except httpx.HTTPError as e:
        raise HTTPException(status_code=500, detail=f"HTTP error occurred: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"OAuth error: {str(e)}")
