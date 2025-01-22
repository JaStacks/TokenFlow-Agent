import 'dotenv/config';
import { Agent } from '@openserv-labs/sdk';
import { z } from 'zod';
import axios, { all } from 'axios';
import fs from 'fs';
import path from 'path';
import { getBestProjectMatch } from './util/dexscreener';
import { formatMessage } from './util/formatter';


// Helper function to fetch tweets from Twitter API
interface Tweet {
  text: string;
}

interface ProcessedTweet {
  text: string;
  ticker: string;
}

interface UserResponse {
  output: {
    data: {
      id: string;
    };
  };
}

interface TweetsResponse {
  output: {
    data: Tweet[];
    meta?: {
      next_token?: string;
    };
  };
}

// Initialize the agent
console.log("Starting AIXBT Scraper agent...");
const agent = new Agent({
  systemPrompt: "You can use your given capabilities to save and load states, fetch new tweets, find ticker information and project information to create tweets and share insights...",
});

// Define `fetchTweets` capability
// This capability fetches tweets from the AIXBT Twitter account using the Twitter API.
// It requires the `howMany` parameter to specify the number of tweets to fetch.
// Usage: agent.runCapability('fetchTweets', { lastProcessedId: '12345', action: { workspace: { id: 'workspace_id' } } });
agent.addCapability({
  name: 'fetchTweets',
  description: 'Fetches tweets from the AIXBT Twitter account. User should specify how many Tickers to fetch.',
  schema: z.object({
    howMany: z.number().nullable(),
  }),
  async run({ args, action }) {
    try {
      console.log(action)
      console.log('Fetching tweets...');
      const tweets = await fetchTweets(args.howMany, action.workspace.id);
      console.log(`Fetched ${tweets.length} tweets.`);
      console.log('Here are the tweets', tweets);
      
      return tweets;
    } catch (error) {
      console.error('Error fetching tweets:', error);
    }
  },
});


async function fetchTweets(howMany: number, passed_workspaceId: number): Promise<Array<{ text: string; ticker: string }>> {
  try {
    console.log("Fetching tweets using callIntegration...");

    // Step 1: Fetch the user ID for the 'aixbt_agent' Twitter account
    const userResponse: UserResponse = await agent.callIntegration({
      workspaceId: passed_workspaceId, // The workspace where the integration is configured
      integrationId: "twitter-v2", // Integration ID for Twitter
      details: {
        endpoint: "/2/users/by/username/aixbt_agent", // Twitter endpoint to fetch the user by username
        method: "GET", // HTTP GET method
      },
    });

    console.log("User Response:", JSON.stringify(userResponse, null, 2));

    const userId = userResponse?.output?.data?.id;
    if (!userId) {
      throw new Error("Failed to fetch user ID for 'aixbt_agent'.");
    }

    console.log(`Fetched User ID for 'aixbt_agent': ${userId}`);

    // Step 2: Fetch recent tweets for the user using the obtained user ID
    let allTweets: Array<{ text: string; ticker: string }> = [];
    let paginationToken: string | undefined = undefined;

    do {
      // Fetch a batch of tweets
      const tweetsResponse: TweetsResponse = await agent.callIntegration({
        workspaceId: passed_workspaceId, // The same workspace ID
        integrationId: "twitter-v2", // Integration ID for Twitter
        details: {
          endpoint: `/2/users/${userId}/tweets`, // Endpoint to fetch tweets by user ID
          method: "GET", // HTTP GET method
          params: {
            max_results: 100, // Fetch up to 100 tweets at a time
            pagination_token: paginationToken, // Use the pagination token for next pages
          },
        },
      });

      const tweets = tweetsResponse?.output?.data ?? [];
      paginationToken = tweetsResponse?.output?.meta?.next_token; // Update pagination token

      if (!tweets.length) {
        console.log("No more tweets to process.");
        break; // Stop if no more tweets are available
      }

      // Process tweets and filter for those with tickers
      const newProcessedTweets = tweets
        .map((tweet) => ({
          text: tweet.text,
          ticker: extractTicker(tweet.text) || '',
        }))
        .filter((tweet) => tweet.ticker !== ''); // Only include tweets with tickers

      // Add new processed tweets to the collection
      allTweets = [...allTweets, ...newProcessedTweets];
      console.log(`Collected ${allTweets.length}/${howMany} tweets with tickers.`);

      // Stop if we have enough tweets
      if (allTweets.length >= howMany) {
        console.log("Collected the requested number of tweets with tickers.");
        console.log(allTweets);
        break;
      }

      // Check for further pagination
      if (!paginationToken) {
        console.log("No further pagination available.");
        break;
      }
    } while (paginationToken);

    // Trim to the exact number requested, if more were fetched
    return allTweets.slice(0, howMany);
  } catch (error) {
    console.error("Error while fetching tweets:", error.message);
    throw error;
  }
}


// Define `dexscreener_fetch` capability to process and fetch project data for a given ticker

// agent.addCapability({
//   name: 'dexscreener_fetch',
//   description: 'Processes an array of tweets given from the fetchTweets capability and fetches associated project data.',
//   schema: z.object({
//     processedTweets: z.array(
//         z.object({
//           text: z.string(),  // The tweet text
//           ticker: z.string(), // The extracted ticker from the tweet
//         })
//       )
//       .default([]), // Default to an empty array if no data is provided
//   }),
//   async run({ args }) {
//     try {
//       console.log('Attempting to process and fetch project data...');
//       const { processedTweets } = args;

//       if (!processedTweets || !Array.isArray(processedTweets)) {
//         throw new Error('No processed tweets provided or invalid format.');
//       }

//       // Process each tweet and fetch project data
//       for (const tweet of processedTweets) {
//         const { ticker, text } = tweet;
//         if (!ticker) continue;

//         // Fetch DexScreener data
//         const projectData = await getBestProjectMatch(ticker);

//         // Format the message
//         const formattedMessage = formatMessage([text], projectData);

//         // Share to Telegram, Discord, and Twitter (implement these functions as needed)
//         // await sendTelegramMessage(telegramChatId, formattedMessage);
//         // await sendDiscordMessage(discordWebhookUrl, formattedMessage);
//         // await postToTwitter(formattedMessage);
//       }

//       return 'Processing and fetching project data completed successfully.';
//     } catch (error) {
//       console.error('Error processing and fetching project data:', error);
//       throw new Error(`Failed to process and fetch project data: ${error.message}`);
//     }
//   },
// });


function extractTicker(text: string): string | null {
  const match = text.match(/\$[A-Z]+/);
  return match ? match[0].replace('$', '') : null;
}

agent.start();

// to do: sometimes tweets, may contain multiple tickers handle that case