# TokenFlow Agent 🚀🤖

A **powerful agent** built with the **OpenServ Labs SDK** for scraping, processing, and analyzing tweets from the AIXBT Twitter account. This agent gathers associated token data from **DexScreener** and delivers formatted token analysis reports to **Telegram chats**. 📊📱

This project leverages **OpenServ Labs'** advanced task management, JSON handling, and integration capabilities to create a modular and extensible scraping agent.

---

## Table of Contents 📚
- [Features ✨](#features-✨)
- [Setup 🛠️](#setup-🛠️)
  - [Clone This Repository 📂](#clone-this-repository-📂)
  - [Install Dependencies 📦](#install-dependencies-📦)
  - [Configure Environment Variables ⚙️](#configure-environment-variables-⚙️)
- [Example Usage 📋](#example-usage-📋)
- [Development 🔧](#development-🔧)
  - [Run the Development Server 🖥️](#run-the-development-server-🖥️)
  - [Code Quality 🧹](#code-quality-🧹)
  - [Building 🏗️](#building-🏗️)
- [Task Workflow 🗂️](#task-workflow-🗂️)
- [Advanced Features 💡](#advanced-features-💡)
- [Example Report Output 📝](#example-report-output-📝)
- [Next Steps 🚀](#next-steps-🚀)
- [Resources 📖](#resources-📖)

---

## Features ✨
### Core Functionalities
- 🐦 **Tweet Scraping**: Fetches and filters tweets mentioning specific token tickers from the AIXBT Twitter account.
- 📊 **DexScreener Integration**: Retrieves token data, including liquidity, price, and volume, for identified tickers.
- ✉️ **Telegram Integration**: Formats token analysis reports into MarkdownV2 for Telegram and delivers them to specified chats.
- 🧩 **Task Management**: Orchestrates tasks with dependencies, ensuring sequential execution for data scraping, processing, and reporting.

### Modular Design 🛠️
- 🌐 Built with **TypeScript** for type safety and scalability.
- ✅ Validates environment variables using **Zod** for reliable configuration.
- 🔄 Configured for extensibility to add new capabilities or platforms.

---

## Setup 🛠️

### Clone This Repository 📂
```bash
git clone <repository-url>
cd <repository-folder>
```

### Install Dependencies 📦
```bash
npm install
```

### Configure Environment Variables ⚙️
1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```
2. Update the `.env` file with your environment variables:
   ```makefile
   OPENSERV_API_KEY=<Your OpenServ Labs API Key>
   TELEGRAM_BOT_TOKEN=<Your Telegram Bot Token>
   WORKSPACE_ID=<Your OpenServ Labs Workspace ID>
   ```

---

## Example Usage 📋
The agent processes user commands to perform end-to-end token analysis. For instance:

#### Example Telegram Command
```bash
/fetch 1h summary
```

#### What Happens:
1. 🐦 **Fetch Tweets**: Scrapes tweets mentioning token tickers in the past 1 hour.
2. 📊 **Process Data**: Uses **DexScreener** to retrieve detailed market data for each token.
3. 📝 **Format Report**: Compiles a MarkdownV2 report, including market stats, social links, and relevant URLs.
4. ✉️ **Deliver to Telegram**: Sends the report to the configured Telegram chat.

---

## Development 🔧

### Run the Development Server 🖥️
The project uses **ts-node-dev** for hot reloading during development:
```bash
npm run dev
```

### Code Quality 🧹
- **Linting**:
  ```bash
  # Check for linting issues
  npm run lint

  # Automatically fix linting issues
  npm run lint:fix
  ```
- **Formatting**:
  ```bash
  # Format the codebase
  npm run format
  ```

### Building 🏗️
- **Build the Project**:
  ```bash
  npm run build
  ```
- **Run the Built Version**:
  ```bash
  npm start
  ```

---

## Task Workflow 🗂️
The agent operates through a **sequential task workflow** to ensure efficient and accurate processing:

1. **Fetch Tweets** 🐦:
   - **Task Name**: `fetchTweets`
   - **Description**: Retrieves tweets mentioning token tickers.
   - **Output**: A JSON file containing the scraped tweets (`aixbt_tweets_<taskDetails>.json`).

2. **Fetch DexScreener Data** 📊:
   - **Task Name**: `dexscreener_fetch`
   - **Description**: Processes tweets and retrieves detailed token data from DexScreener.
   - **Output**: A JSON file with token market data (`aixbt_dexscreener_<taskDetails>.json`).

3. **Format Report for Telegram** 📝:
   - **Task Name**: `formatMessage`
   - **Description**: Formats the DexScreener data into a MarkdownV2 report for Telegram.
   - **Output**: A JSON file with the formatted message (`aixbt_telegram_<taskDetails>.json`).

4. **Send to Telegram** ✉️:
   - **Task Name**: `sendTelegramMessage`
   - **Description**: Sends the formatted message to a specified Telegram chat.
   - **Output**: Confirmation of the message delivery.

---

## Advanced Features 💡
1. **Telegram Integration** ✉️:
   - Sends real-time reports to Telegram chats using the Telegram Bot API.
   - Fully compatible with Telegram MarkdownV2 for styled messages.

2. **JSON Processing** 📄:
   - Handles dynamic JSON structures from APIs like DexScreener.
   - Validates and transforms data into user-friendly reports.

3. **Custom Task Management** 🧩:
   - Define dependencies to ensure sequential task execution.
   - Easily extendable with new capabilities for additional workflows.

---

## Example Report Output 📝
Here’s a sample **Telegram MarkdownV2 report** for a token:

```plaintext
*cloudyheart (cloudy)* 📊

*Tweet*: "$CLOUDY token dump and rebuy happening now!"

🔍 *Market Data*:
• Chain: solana
• DEX: raydium
• Liquidity: $916,540.43
• Price (USD): $0.017
• 24H Volume: $32,234,441.04

💹 *Social Media Links*:
• Twitter: [Link](https://x.com/cl0udyh3art)
• Telegram: [Link](https://t.me/cl0udyheart)

🌐 *Websites*:
• [https://www.cloudyheart.net/](https://www.cloudyheart.net/)

🔗 *DexScreener Link*: [View on DexScreener](https://dexscreener.com/solana/4soxi47utpbzuusw27i9vq7ogkwrz8xlrj2fruunnsjg)
```

---

## Next Steps 🚀
To expand the functionality of this agent, consider:
- Adding support for additional APIs (e.g., **CoinGecko**, **Twitter Trends**).
- Implementing advanced **inter-agent communication** for collaborative tasks.
- Enabling **webhook integrations** for real-time data updates.

---

## Resources 📖
- **[OpenServ Labs SDK Documentation](#)**: Official SDK documentation.
- **[Telegram Bot API](https://core.telegram.org/bots/api)**: Build interactive bots for Telegram.
- **[DexScreener API](https://docs.dexscreener.com/)**: Retrieve real-time token data.

Feel free to reach out with feedback or contribute to the project for further improvements! 🌟
