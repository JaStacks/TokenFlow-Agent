import axios from 'axios';

const TELEGRAM_API_URL = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}`;

export async function joinTelegramGroup(inviteLink: string): Promise<void> {
  try {
    const response = await axios.post(`${TELEGRAM_API_URL}/joinChat`, {
      invite_link: inviteLink,
    });

    if (response.data.ok) {
      console.log('Successfully joined Telegram group.');
    } else {
      throw new Error(`Failed to join Telegram group: ${response.data.description}`);
    }
  } catch (error) {
    console.error('Error joining Telegram group:', error);
    throw error;
  }
}

export async function sendTelegramMessage(chatId: string, message: string): Promise<void> {
  try {
    await axios.post(`${TELEGRAM_API_URL}/sendMessage`, {
      chat_id: chatId,
      text: message,
      parse_mode: 'Markdown',
    });
    console.log('Message sent to Telegram successfully.');
  } catch (error) {
    console.error('Error sending message to Telegram:', error);
    throw error;
  }
}
