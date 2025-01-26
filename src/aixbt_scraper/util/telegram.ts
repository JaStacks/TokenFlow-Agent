import { env } from "process";
import { agent, createTask } from "..";
const TelegramBot = require('node-telegram-bot-api');

// Initialize the Telegram bot
export const bot = new TelegramBot(env.TELEGRAM_BOT_TOKEN, { polling: true });

export function startTelegramBot() {
  console.log('Starting Telegram bot...');

  // Handle incoming messages
  bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const messageText = msg.text?.trim() || '';

    // Basic command structure
    if (messageText.startsWith('/fetch')) {
      const taskDetails = messageText.replace('/task', '').trim();

      if (!taskDetails) {
        bot.sendMessage(chatId, 'Please provide task details after the /task command.');
        return;
      }

      try {

        const response = await createTask(taskDetails, chatId);

        bot.sendMessage(chatId, `Task created successfully! Task ID: ${response.id}`);
      } catch (error) {
        console.error('Error creating task:', error);
        bot.sendMessage(chatId, 'Failed to create task. Please try again.');
      }
    }
  });

  // Error handling for the bot
  bot.on('error', (error) => {
    console.error('Telegram bot error:', error);
  });

  bot.on('polling_error', (error) => {
    console.error('Telegram polling error:', error);
  });
}
