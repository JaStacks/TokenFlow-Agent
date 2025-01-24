import { agent, TweetsResponse } from "..";
import { extractTicker, pruneDeque } from "./helper_functions";
import { loadDequeFromWorkspace, loadState, saveState } from "./stateUtils";
import * as fs from 'fs';
import { Deque } from '@datastructures-js/deque';


export async function fetchTweets(
    howMany: number | undefined,
    timeRangeInHours: number | undefined,
    passed_workspaceId: number
): Promise<Array<{ text: string; ticker: string; id: string }>> {
    const nowUTC = new Date();
    const validTimeRange = timeRangeInHours && !isNaN(timeRangeInHours) ? timeRangeInHours : 24; // Default to last 24 hours
    console.log(`Fetching tweets from the last ${validTimeRange} hours...`);
    const start_time = new Date(nowUTC.getTime() - validTimeRange * 60 * 60 * 1000).toISOString();
    const end_time = nowUTC.toISOString();

    const tweetCachepath = 'tweetsCache.json';
    const rawtweetCache = (await loadDequeFromWorkspace(passed_workspaceId, tweetCachepath));
    const tweetCache = new Deque((rawtweetCache || []) as unknown as any[]); // Initialize Deque with loaded tweets or empty array

    const stateFile = 'fetchTweetsState.json';
    const state = (await loadState(passed_workspaceId, stateFile)) || {};

    let lastID = state.lastID; // Load `lastID` from state if it exists
    let sinceID = state.sinceID; // Load `sinceID` from state if it exists
    let paginationToken: string | undefined = undefined; // Start with no token
    const allTweets: Array<{ text: string; ticker: string, id: string }> = [];

    if (lastID && sinceID && lastID === sinceID) { // Check if we've fetched all tweets since the last call
        console.log('No new tweets since the last fetch.');
        return [];
    }

    // Fetch the user ID for the Twitter account
    const userIdResponse = await agent.callIntegration({
        workspaceId: passed_workspaceId,
        integrationId: "twitter-v2",
        details: {
            endpoint: "/2/users/by/username/aixbt_agent",
            method: "GET",
        },
    });

    const userId = userIdResponse?.output?.data?.id;
    if (!userId) {
        console.error("Failed to fetch user ID for the Twitter account.");
        return [];
    }

    console.log(`Fetching tweets from ${start_time} to ${end_time}`);


    // Fetch tweets with pagination
    do {
        console.log(`Fetching tweets with pagination token: ${paginationToken}`);
        const tweetsResponse: TweetsResponse = await agent.callIntegration({
            workspaceId: passed_workspaceId,
            integrationId: "twitter-v2",
            details: {
                endpoint: `/2/users/${userId}/tweets`,
                method: "GET",
                params: {
                    max_results: 100,
                    start_time: start_time,
                    end_time: end_time,
                    pagination_token: paginationToken, // Use `pagination_token` for pagination
                    since_id: paginationToken ? undefined : sinceID, // Use `sinceID` to fetch only new tweets
                },
            },
        });

        const tweets = tweetsResponse?.output?.data ?? [];
        paginationToken = tweetsResponse?.output?.meta?.next_token; // Update the pagination token for next call

        if (!tweets.length) {
            console.log("No tweets found in this batch.");
            break;
        } else {
            lastID = tweets[tweets.length - 1].id;
        }
        try {
            fs.appendFileSync("./tweets_output.json", JSON.stringify(tweets, null, 2) + ",\n");
        } catch (error) {
            console.error(`Error writing tweet to file:`, error);
        }
        console.log(`Fetched ${tweets.length} tweets in this batch.`);

        // Save `sinceID` from the first (earliest) tweet
        if (!sinceID && tweets.length > 0) {
            sinceID = tweets[0].id;
            console.log(`Set sinceID to: ${sinceID}`);
        }

        // Process tweets and extract tickers
        const processedTweets = tweets
            .map((tweet) => ({
                text: tweet.text,
                ticker: extractTicker(tweet.text) || '',
                id: tweet.id, // Include `id` for debugging purposes
                timestamp: new Date(tweet.created_at).getTime(),
            }))
            .filter((tweet) => tweet.ticker !== ''); // Include only tweets with tickers

        console.log(`Processed ${processedTweets.length} tweets with tickers.`);

        // Add processed tweets to the main collection
        allTweets.push(...processedTweets);
        

        // Lets update our queue, prune it first

        const cutoffTime = Date.now() - 24 * 60 * 60 * 1000; // 24 hours ago
        pruneDeque(tweetCache);
        // Update the rolling cache with new tweets
        updateRollingCache(tweetCache, processedTweets);

        // If we've collected enough tweets, stop
        if (howMany !== undefined && allTweets.length >= howMany) {
            console.log("Collected the requested number of tweets.");
            break;
        }
    } while (paginationToken); // Continue while there is a pagination token

    // Save the latest `sinceID` to the state file for future calls
    if (sinceID && sinceID !== state.sinceID && lastID && lastID !== state.lastID) {
        await saveState(passed_workspaceId, { sinceID, lastID }, stateFile);
        console.log(`Saved state with sinceID: ${sinceID}, lastID: ${lastID}`);
    }

    console.log(`Total processed tweets: ${allTweets.length}`);

    // Update the rolling cache with new tweets
    updateRollingCache(tweetCache, allTweets);

    return allTweets.slice(0, howMany || allTweets.length);
}

// update the rolling cache with new tweets

function updateRollingCache(cache, newTweets) {
    const cutoffTime = Date.now() - 24 * 60 * 60 * 1000; // 24 hours ago

    // Add new tweets
    newTweets.forEach(tweet => {
        tweet.timestamp = new Date(tweet.timestamp).getTime(); // Ensure timestamp is numeric
        cache.pushFront(tweet);
    });

    // Remove tweets older than 24 hours
    while (cache.length && cache.peekFront().timestamp < cutoffTime) {
        cache.pushFront();
    }
}

// prune the rolling cache

function pruneDeque(deque) {
    try {
      if (!(deque instanceof Deque)) {
        throw new Error("Invalid data type for deque. Expected a Deque.");
      }
  
      const cutoffTime = Date.now() - 24 * 60 * 60 * 1000; // 24-hour cutoff
      let prunedCount = 0;
  
      while (deque.length && deque.peekFront().timestamp < cutoffTime) {
        deque.shift();
        prunedCount++;
      }
  
      console.log(`Pruned ${prunedCount} old tweets from the Deque.`);
    } catch (error) {
      console.error(`Error in pruneDeque: ${error.message}`);
      throw error; // Optionally rethrow the error if critical
    }
  }
  