import os
from dotenv import load_dotenv
from Handlers.bot_handler import BotHandler
from Handlers.message_handler import MessageHandler

load_dotenv()

TELEGRAM_TOKEN = os.getenv("TELEGRAM_TOKEN")

if __name__ == "main":
    ### Inyectamos las dependencias
    message_handler = MessageHandler()
    bot = BotHandler(TELEGRAM_TOKEN, message_handler)
    bot.run()