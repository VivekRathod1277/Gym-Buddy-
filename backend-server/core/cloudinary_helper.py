import os
from dotenv import load_dotenv

load_dotenv()

import cloudinary
import cloudinary.uploader
import cloudinary.api

# Cloudinary is automatically configured by the CLOUDINARY_URL environment variable if set
# Otherwise you can configure it explicitly like below if you prefer reading parts
# cloudinary.config(
#   cloud_name = os.getenv('CLOUDINARY_CLOUD_NAME'),
#   api_key = os.getenv('CLOUDINARY_API_KEY'),
#   api_secret = os.getenv('CLOUDINARY_API_SECRET')
# )

def upload_video_to_cloudinary(file_path: str, public_id: str = None) -> str:
    """
    Uploads a video to Cloudinary and returns the secure URL.
    """
    try:
        response = cloudinary.uploader.upload(
            file_path,
            resource_type="video",
            public_id=public_id,
            folder="gym_posture_videos"
        )
        return response.get("secure_url")
    except Exception as e:
        print(f"Cloudinary upload failed: {e}")
        return None

def upload_image_to_cloudinary(file_path: str, public_id: str = None) -> str:
    """
    Uploads an image to Cloudinary and returns the secure URL.
    """
    try:
        response = cloudinary.uploader.upload(
            file_path,
            resource_type="image",
            public_id=public_id,
            folder="gym_posture_images"
        )
        return response.get("secure_url")
    except Exception as e:
        print(f"Cloudinary upload failed: {e}")
        return None
