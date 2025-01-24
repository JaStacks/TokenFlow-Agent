import 'dotenv/config';
import { Agent } from '@openserv-labs/sdk';
import { z } from 'zod';
import axios, { all } from 'axios';
import * as fs from 'fs';
import path from 'path';
import { getBestProjectMatch, getProjectLinks } from './util/dexscreener';
import { formatMessage } from './util/formatter';
import { extractTicker } from './util/helper_functions';
import { loadState, saveState } from './util/stateUtils';
import { fetchTweets } from './util/twitter';


export interface Tweet {
  created_at: string | number | Date;
  text: string;
  ticker: string;
  id: string;
}
export interface TweetsResponse {
  output: {
    data: Tweet[];
    meta?: {
      next_token?: string;
    };
  };
}

// Initialize the agent
console.log("Starting AIXBT Scraper agent...");
export const agent = new Agent({
  systemPrompt: "You can use your given capabilities to save and load states, fetch new tweets, find ticker information and project information to help other swarm agents create insights.",
});

// 'fetchTweets' capability fetches recent tweets from the AIXBT Twitter account, howMany and timeRangeInHours are optional parameters.

agent.addCapability({
  name: "fetchTweets",
  description: "Fetches recent tweets from the AIXBT Twitter account. You can specify the number of tweets and the time range (in hours). If unspecified, it defaults to fetching all tweets from the last 24 hours.",
  schema: z.object({
    howMany: z.number().optional().describe("The maximum number of tweets to fetch. Leave blank to fetch all available tweets within the time range."),
    timeRangeInHours: z.number().optional().describe("The time range (in hours) to fetch tweets from. Defaults to the last 24 hours if unspecified."),
    passed_workspaceId: z.number().describe("The workspace ID where the Twitter integration is configured."),
  }),
  async run({ args, action }) {
    try {
      console.log('Fetching tweets...');
      const tweets = await fetchTweets(args.howMany, args.sinceTime, action.workspace.id);
      console.log(`Fetched ${tweets.length} tweets.`);
      return JSON.stringify(tweets);
    }
    catch (error) {
      console.error('Error fetching tweets:', error);
    }
  },
});

// 'dexscreener_fetch' capability fetches project data from DexScreener based on the provided tweets.

agent.addCapability({
  name: 'dexscreener_fetch',
  description: 'Processes an array of tweets given from the fetchTweets capability and fetches associated project data.',
  schema: z.object({
    processedTweets: z
      .array(
        z.object({
          text: z.string(), // The tweet text
          ticker: z.string(), // The extracted ticker from the tweet
          id: z.string(), // The tweet ID (for debugging purposes)
        })
      )
      .default([]), // Default to an empty array if no data is provided
  }),
  async run({ args }) {
    try {
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

      console.log('Attempting to process and fetch project data...');
      const { processedTweets } = args;

      if (!processedTweets || !Array.isArray(processedTweets)) {
        throw new Error('No processed tweets provided or invalid format.');
      }
      // Initialize a set to keep track of fetched tickers
      const fetchedTickers = new Set<string>();
      // Process each tweet and fetch project data
      for (const tweet of processedTweets) {
        const { ticker, text } = tweet;
        if (!ticker) continue;

        if (fetchedTickers.has(ticker)) {
          console.log(`Skipping duplicate ticker: "${ticker}".`);
          continue;
        }
        try {

          fetchedTickers.add(ticker);
          // Fetch DexScreener data (fetching only the best project)
          const projectData: {
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
          } | null = await getBestProjectMatch(ticker);

          if (!projectData) {
            console.log(`No project data found for ticker "${ticker}".`);
            continue;
          }

          // Format the message
          results.push({
            tweetText: text,
            dexScreenerLink: projectData.dexScreenerLink,
            projectTwitterLink: projectData.projectTwitterLink || undefined,
            projectTelegramLink: projectData.projectTelegramLink || undefined,
            projectWebsites: projectData.projectWebsites?.length ? projectData.projectWebsites : undefined,
            baseTokenName: projectData.baseTokenName,
            baseTokenSymbol: projectData.baseTokenSymbol,
            chainId: projectData.chainId,
            dexId: projectData.dexId,
            liquidity: `$${Number(projectData.liquidity).toLocaleString()}`,
            priceUsd: `$${Number(projectData.priceUsd).toLocaleString()}`,
            volume24h: `$${Number(projectData.volume24h).toLocaleString()}`,
          });
        } catch (err) {
          console.error(`Error processing tweet with ticker "${ticker}":`, err);
        }
      }
    
      // Return the results as a prettified JSON string
      return JSON.stringify(results, null, 2);
    } catch (error) {
      console.error('Error processing and fetching project data:', error);
      throw new Error(`Failed to process and fetch project data: ${error.message}`);
    }
  },
});


agent.start();

// to do: sometimes tweets, may contain multiple tickers handle that case

// to do: implement since_id for pagination, instead of page, we can fetch more tweets since a certain tweet id