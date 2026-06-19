import os
import mysql.connector
from mysql.connector import Error
from dotenv import load_dotenv

load_dotenv()

def get_connection():
    try:
        connection = mysql.connector.connect(
            host=os.getenv("DB_HOST"),
            port=int(os.getenv("DB_PORT", 28420)),                     
            user=os.getenv("DB_USER"),                
            password=os.getenv("DB_PASSWORD"),
            database=os.getenv("DB_NAME"),            
            charset='utf8mb4',
            ssl_disabled=False
        )
        return connection
    except Error as e:
        print(f"Error: {e}")
        return None
