import telebot
from message_handler import MessageHandler

class BotHandler:
    '''
    Bot that will communicate with Telegram
    '''
    def __init__(self, api_token: str, message_hanlder: MessageHandler):
        self.bot = telebot.TeleBot(api_token)
        self.message_handler = message_hanlder
        
        # Not the best practice to put this method to the init level but problem for the future
        @self.bot.message_handler(func=lambda message: True)
        def process(message):
            # response = self.router.route(message.text)
            response = "hola mundo"
            self.bot.reply_to(message, response)

    def run(self):
        print("bot calendarioInteligente ejecutandose")
        self.bot.infinity_polling()
        