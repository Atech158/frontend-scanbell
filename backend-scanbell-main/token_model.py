from pymongo import MongoClient
import os
from dotenv import load_dotenv

load_dotenv()

client = MongoClient(os.getenv("MONGO_URL"))
db = client["scanbell"]
tokens = db["fcm_tokens"]


def save_token_db(user_id, fcm_token):
    result = tokens.update_one(
        {"userId": user_id},
        {"$set": {"fcmToken": fcm_token}},
        upsert=True
    )
    return result
