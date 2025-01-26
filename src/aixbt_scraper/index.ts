import 'dotenv/config';
import { Agent } from '@openserv-labs/sdk';
import { z } from 'zod';
import axios, { all } from 'axios';
import * as fs from 'fs';
import path from 'path';
import { getBestProjectMatch, getProjectLinks } from './util/dexscreener';
import { formatMessage } from './util/formatter';
import { convertToTelegramMarkdown, extractTickers, generateReport, pruneDeque } from './util/helper_functions';
import { loadDequeFromWorkspace, loadState, saveDequeToWorkspace, saveState } from './util/stateUtils';
import { fetchTweets, fetchTweetsInRange } from './util/twitter';
import { Deque } from '@datastructures-js/deque';
import { bot, startTelegramBot } from './util/telegram';


// Initialize the agent
console.log("Starting AIXBT Scraper agent...");
export const agent = new Agent({
  systemPrompt: "You can use your given capabilities to save and load states, fetch new tweets, find ticker information and project information to help other swarm agents create insights.",
});

// 'fetchTweets' capability fetches recent tweets from the AIXBT Twitter account, howMany and timeRangeInHours are optional parameters.

agent.addCapability({
  name: "fetchTweets",
  description: "Fetches recent tweets from the AIXBT Twitter account. Dynamically fetches older or newer tweets as required and maintains a rolling ticker cache. Expect to be queried by a command such as `/fetch 1 hr summary`.",
  schema: z.object({
    howMany: z.number().optional().describe("The maximum number of tweets to fetch. Leave blank to fetch all available tweets within the time range."),
    timeRangeInHours: z.number().optional().describe("The time range (in hours) to fetch tweets from. Defaults to the last 24 hours if unspecified."),
  }),
  async run({ args, action }) {
    try {
      const workspaceId = action.workspace.id;
      const tweetCachePath = "tweetsCache.json";
      const tickerCachePath = "tickerCache.json";
      const stateFile = "fetchTweetsState.json";

      // Load state and caches
      const state = (await loadState(workspaceId, stateFile)) || {};
      const tweetCache = (await loadDequeFromWorkspace(workspaceId, tweetCachePath)) || new Deque([]);
      const tickerCache: Record<string, Array<{ text: string; id: string; timestamp: string }>> =
        (await loadState(workspaceId, tickerCachePath)) || {};

      const validTimeRange = args.timeRangeInHours && !isNaN(args.timeRangeInHours) ? args.timeRangeInHours : 24;
      const now = Date.now();
      const cutoffTime = now - validTimeRange * 60 * 60 * 1000;
      const isFirstInitialization = !state.earliestTime && !state.latestTime;

      const earliest_tweet = state.earliestTime
        ? new Date(state.earliestTime).getTime()
        : now; // Default to now if earliestTime is not set
      let latest_tweet = state.latestTime
        ? new Date(state.latestTime).getTime()
        : cutoffTime; // Default to 0 if latestTime is not set

      console.log(`Valid time range: last ${validTimeRange} hours`);
      console.log(`Cutoff time: ${new Date(cutoffTime).toISOString()}`);

      // Step 1: Filter existing tweets from cache
      const filteredCachedTweets = tweetCache
        .toArray()
        .filter((tweet) => {
          const tweetTime = new Date(tweet.timestamp).getTime(); // Convert to numeric timestamp
          return tweetTime >= cutoffTime && tweetTime <= now;
        });

      console.log(`Found ${filteredCachedTweets.length} tweets in the cache within the requested time range.`);

      // Step 2: Check if we need to fetch more tweets
      const missingOlderTweets =
        isFirstInitialization || (!isFirstInitialization && new Date(cutoffTime).getTime() < earliest_tweet);

      // Evaluate whether newer tweets are missing
      const missingNewerTweets =
        isFirstInitialization || (!isFirstInitialization && latest_tweet < new Date(now).getTime());

      console.log("isFirstInitialization:", isFirstInitialization);
      console.log("missingOlderTweets:", missingOlderTweets);
      console.log("missingNewerTweets:", missingNewerTweets);


      const allTweets: Array<{ text: string; ticker: string; id: string; timestamp: string }> = [...filteredCachedTweets];

      if (missingOlderTweets) {
        console.log("Fetching older tweets...");
        await fetchTweetsInRange(
          workspaceId,
          cutoffTime,
          earliest_tweet,
          allTweets,
          tweetCache,
          new Set(Object.keys(tickerCache)),
          true // Fetch older tweets
        );

        // After fetching older tweets, update the state and reevaluate
        state.earliestTime = tweetCache.back()?.timestamp; // Update earliestTime
        console.log("Updated earliestTime after fetching older tweets:", state.earliestTime);

        // Recalculate `latest_tweet` for the next condition
        const latestTweetInCache = tweetCache.front()?.timestamp;
        if (latestTweetInCache) {
          latest_tweet = new Date(latestTweetInCache).getTime();
        }
      }

      // Reevaluate missingNewerTweets with the updated `latest_tweet`
      if (missingNewerTweets) {
        console.log("Fetching newer tweets...");
        await fetchTweetsInRange(
          workspaceId,
          now,
          latest_tweet,
          allTweets,
          tweetCache,
          new Set(Object.keys(tickerCache)),
          false // Fetch newer tweets
        );

        // After fetching newer tweets, update the state
        state.latestTime = tweetCache.front()?.timestamp; // Update latestTime
        console.log("Updated latestTime after fetching newer tweets:", state.latestTime);
      } else {
        console.log("No newer tweets to fetch.");
      }



      // Step 3: Save updated caches and state
      pruneDeque(tweetCache);
      await saveDequeToWorkspace(workspaceId, tweetCache, tweetCachePath,);
      // await saveState(workspaceId, tickerCache, tickerCachePath);
      // await saveState(workspaceId, state, stateFile);

      // Step 4: Filter combined tweets within the requested time range
      const filteredTweets = allTweets.filter(
        (tweet) => new Date(tweet.timestamp).getTime() >= cutoffTime && new Date(tweet.timestamp).getTime() <= now
      );

      console.log(`Filtered ${filteredTweets.length} tweets within the requested time range.`);
      return JSON.stringify(filteredTweets.slice(0, args.howMany || filteredTweets.length));
    } catch (error) {
      console.error("Error fetching tweets:", error);
      throw new Error("Failed to fetch tweets. Please try again later.");
    }
  },
});



// 'dexscreener_fetch' capability fetches project data from DexScreener based on the provided tweets.

agent.addCapability({
  name: 'dexscreener_fetch',
  description: 'Processes an array of tweets from fetchTweets and fetches associated project data from DexScreener.',
  schema: z.object({
    processedTweets: z
      .array(
        z.object({
          text: z.string(), // Tweet text
          ticker: z.string(), // Extracted ticker from the tweet
          id: z.string(), // Tweet ID (for debugging purposes)
        })
      )
      .default([]), // Defaults to an empty array
  }),
  async run({ args }) {
    try {
      console.log('Processing tweets and fetching project data...');
      const { processedTweets } = args;

      // Validate input
      if (!processedTweets || !Array.isArray(processedTweets)) {
        throw new Error('Invalid or missing processedTweets array.');
      }

      const fetchedTickers = new Set<string>();
      const results: Array<{
        tweetText: string;
        dexScreenerLink: string;
        projectTwitterLink?: string;
        projectTelegramLink?: string;
        projectWebsites?: string[];
        baseTokenName: string;
        baseTokenSymbol: string;
        chainId: string;
        dexId: string;
        liquidity: string;
        priceUsd: string;
        volume24h: string;
      }> = [];

      // Iterate through tweets
      for (const { ticker, text } of processedTweets) {
        if (!ticker || fetchedTickers.has(ticker)) {
          if (!ticker) console.log('Skipping tweet with no ticker.');
          else console.log(`Skipping duplicate ticker: "${ticker}".`);
          continue;
        }

        try {
          fetchedTickers.add(ticker);

          // Fetch DexScreener data
          const projectData = await getBestProjectMatch(ticker);
          console.log(`Fetched project data for ticker ${ticker}`);
          // Skip if no valid project data is found
          if (!projectData || !projectData["dexScreenerLink"] || !projectData["baseTokenName"] || !projectData["baseTokenSymbol"]) {
            console.log(`Invalid or incomplete project data for ticker "${ticker}". Skipping...`);
            continue;
          }

          // Push valid project data to results
          results.push({
            tweetText: text,
            dexScreenerLink: projectData["dexScreenerLink"], // Explicit access
            projectTwitterLink: projectData["projectTwitterLink"] || null,
            projectTelegramLink: projectData["projectTelegramLink"] || null,
            projectWebsites: projectData["projectWebsites"]?.length ? projectData["projectWebsites"] : null,
            baseTokenName: projectData["baseTokenName"],
            baseTokenSymbol: projectData["baseTokenSymbol"],
            chainId: projectData["chainId"],
            dexId: projectData["dexId"],
            liquidity: `$${Number(projectData["liquidity"] || 0).toLocaleString()}`,
            priceUsd: `$${Number(projectData["priceUsd"] || 0).toLocaleString()}`,
            volume24h: `$${Number(projectData["volume24h"] || 0).toLocaleString()}`,
          });

        } catch (err) {
          console.error(`Error processing ticker "${ticker}":`, err);
        }
      }

      // Return results as formatted JSON
      return JSON.stringify(results);
    } catch (error) {
      console.error('Error in dexscreener_fetch:', error.message || error);
      throw new Error(`Failed to process and fetch project data: ${error.message || error}`);
    }
  },
});

// Add the `sendTelegramMessage` capability
agent.addCapability({
  name: "sendTelegramMessage",
  description: "Sends a message to a specific Telegram chat.",
  schema: z.object({
    chatId: z.number().describe("The Telegram chat ID to send the message to."),
    message: z.string().describe("The message content to send."),
  }),
  run: async ({ args }) => {
    try {
      await bot.sendMessage(args.chatId, args.message);
      console.log(`Message sent to chat ${args.chatId}: ${args.message}`);
      return JSON.stringify({ success: true });
    } catch (error) {
      console.error(`Error sending message to chat ${args.chatId}:`, error);
      return { success: false, error: error.message };
    }
  },
});


/**
 * Capability for formatting a message
 */
agent.addCapability({
  name: "formatMessage",
  description: "Formats a DexScreener token analysis report for Telegram.",
  schema: z.object({
    data: z
      .array(
        z.object({
          tweetText: z.string().describe("Text of the tweet."),
          dexScreenerLink: z.string().describe("DexScreener link for the token."),
          projectTwitterLink: z.string().nullable().optional().describe("Project's Twitter link."),
          projectTelegramLink: z.string().nullable().optional().describe("Project's Telegram link."),
          projectWebsites: z.array(z.string()).nullable().optional().describe("List of project website URLs."),
          baseTokenName: z.string().describe("Base token name."),
          baseTokenSymbol: z.string().describe("Base token symbol."),
          chainId: z.string().describe("Blockchain network ID."),
          dexId: z.string().describe("Decentralized exchange ID."),
          liquidity: z.string().describe("Liquidity value."),
          priceUsd: z.string().describe("Price in USD."),
          volume24h: z.string().describe("24-hour trading volume."),
        })
      )
      .describe("Array of token data objects."),
  }),
  async run({ args }) {
    try {
      const report = generateReport(args.data);
      return JSON.stringify({ success: true, message: convertToTelegramMarkdown(report) });
    } catch (error) {
      console.error("Error generating report:", error);
      throw new Error("Failed to generate report. Please check the input data.");
    }
  },
});

export async function createTask(taskDetails: string, chatId: any): Promise<{ id: number; status: string }> {
  try {
    const passed_chatId = chatId
    const workspaceId = parseInt(process.env.WORKSPACE_ID || "0");
    if (isNaN(workspaceId)) {
      throw new Error("Invalid WORKSPACE_ID. Please set a valid workspace ID in the environment variables.");
    }

    // Task 1: Fetch Tweets
    const fetchTweets = await agent.createTask({
      workspaceId,
      assignee: 125, // Ensure this is a valid agent ID
      description: `Fetch tweets using the details: ${taskDetails}, You only need to use capability: fetchTweets`,
      body: "Fetch tweets using the taskDetails from the AIXBT Twitter account. You only need to use capability: fetchTweets",
      input: 'tweetsCache.json if it exists, fetchTweetsState.json if it exists, tickerCache.json if it exists',
      expectedOutput: `JSON Response with tweets data named aixbt_tweets_${taskDetails}.json`,
      dependencies: [], // No dependencies for the first task
    });
    

    // Task 2: Fetch DexScreener Data
    const fetchDex = await agent.createTask({
      workspaceId,
      assignee: 125,
      description: "Fetch data from Dexscreener using capability: dexscreener_fetch from JSON response from capability fetchTweets",
      body: "Fetch data from DexScreener, only tools required are dexscreener_fetch, and JSON response from fetchTweets",
      input: `aixbt_tweets_${taskDetails}.json`,
      expectedOutput: `JSON Response with project data named aixbt_dexscreener_${taskDetails}.json`,
      dependencies: [fetchTweets.id], // Depends on fetchTweets
    });
    

    // Task 3: Format for Telegram
    const formatForTelegram = await agent.createTask({
      workspaceId,
      assignee: 125,
      description: "Format Dexscreener data for Telegram messages",
      body: `Prepare the formatted message for Telegram from aixbt_dexscreener_${taskDetails}.json, only tool required is formatMessage`,
      input: `aixbt_dexscreener_${taskDetails}.json`,
      expectedOutput: `Formatted results saved as aixbt_telegram_${taskDetails}.json`,
      dependencies: [fetchDex.id], // Depends on fetchDex
    });
    
    // Task 4: Send to Telegram
    const sendToTelegram = await agent.createTask({
      workspaceId,
      assignee: 125,
      description: "Send the formatted message to Telegram",
      body: "Send the formatted message to a specific Telegram chat, only tool required is sendTelegramMessage",
      input: `aixbt_telegram_${taskDetails}.json and chatId: ${passed_chatId}`,
      expectedOutput: "Confirmation of message sent to Telegram",
      dependencies: [formatForTelegram.id], // Depends on formatForTelegram
    });

    // Return the last task's metadata for tracking
    console.log("All tasks created successfully:", {
      fetchTweets,
      fetchDex,
      formatForTelegram,
      sendToTelegram,
    });

    return { id: sendToTelegram.id || 0, status: sendToTelegram.status || "unknown" };
  } catch (error) {
    console.error("Error creating tasks:", error);
    throw new Error("Task creation failed.");
  }
}

agent.start();
startTelegramBot();
// to do: sometimes tweets, may contain multiple tickers handle that case

// to do: implement since_id for pagination, instead of page, we can fetch more tweets since a certain tweet id