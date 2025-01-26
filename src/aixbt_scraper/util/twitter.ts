import { agent, TweetsResponse } from "..";
import { extractTickers, pruneDeque } from "./helper_functions";
import { loadDequeFromWorkspace, loadState, saveDequeToWorkspace, saveState } from "./stateUtils";
import * as fs from 'fs';
import { Deque } from '@datastructures-js/deque';

// Helper function to fetch tweets in a given time range
export async function fetchTweetsInRange(
    passed_workspaceId: number,
    startTime: number,
    endTime: number,
    allTweets: Array<{ text: string; ticker: string; id: string }>,
    tweetCache: any,
    tickerSet: Set<string>,
    isOlderTweets: boolean
) {
    const stateFile = 'fetchTweetsState.json';
    const state = (await loadState(passed_workspaceId, stateFile)) || {};
    let paginationToken: string | undefined = undefined;

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
        throw new Error("Failed to fetch user ID for the Twitter account.");
    }

    console.log('Fetching tweets from start time:', new Date(startTime).toISOString());
    console.log('Fetching tweets until end time:', new Date(endTime).toISOString());
    const params: Record<string, any> = {
        max_results: 100,
        start_time: new Date(startTime).toISOString(),
        end_time: new Date(endTime).toISOString(),
        "tweet.fields": "created_at",
    };

    do {
        try {
            if (paginationToken) {
                params.pagination_token = paginationToken;
            }

            const tweetsResponse: TweetsResponse = await agent.callIntegration({
                workspaceId: passed_workspaceId,
                integrationId: "twitter-v2",
                details: {
                    endpoint: `/2/users/${userId}/tweets`,
                    method: "GET",
                    params,
                },
            });

            const tweets = tweetsResponse?.output?.data ?? [];
            paginationToken = tweetsResponse?.output?.meta?.next_token || undefined;

            if (!tweets.length) {
                console.log("No tweets found in this batch.");
                break;
            }

            console.log(`Fetched ${tweets.length} tweets in this batch.`);

            if (isOlderTweets) {
                // Process older tweets: Push to the back of the cache
                tweets.forEach((tweet, index) => {
                    const tickers = extractTickers(tweet.text);
                    tickers.forEach((ticker) => {
                        // Add to tickerSet
                        tickerSet.add(ticker);

                        const processedTweet = {
                            text: tweet.text,
                            ticker,
                            id: tweet.id,
                            timestamp: new Date(tweet.created_at).toISOString(),
                        };

                        // Add to allTweets
                        allTweets.push(processedTweet);

                        // Add older tweets to the back
                        tweetCache.pushBack(processedTweet);
                    });

                    // Update state with the earliest tweet
                    if (index === tweets.length - 1) {
                        if (state.earliest_id !== tweet.id) {
                            state.earliest_id = tweet.id;
                            state.earliestTime = new Date(tweet.created_at).toISOString();
                            console.log("State updated with new earliest ID and timestamp.");
                        }
                    }
                });
            } else {
                // Process newer tweets: Push to the front of the cache in reverse order
                const reversedTweets = [...tweets].reverse();

                reversedTweets.forEach((tweet, index) => {
                    const tickers = extractTickers(tweet.text);
                    tickers.forEach((ticker) => {
                        // Add to tickerSet
                        tickerSet.add(ticker);

                        const processedTweet = {
                            text: tweet.text,
                            ticker,
                            id: tweet.id,
                            timestamp: new Date(tweet.created_at).toISOString(),
                        };

                        // Add to allTweets
                        allTweets.push(processedTweet);

                        // Add newer tweets to the front
                        tweetCache.pushFront(processedTweet);
                    });

                    // Update state with the latest tweet
                    if (index === 0) {
                        if (state.latest_id !== tweet.id) {
                            state.latest_id = tweet.id;
                            state.latestTime = new Date(tweet.created_at).toISOString();
                            console.log("State updated with new latest ID and timestamp.");
                        }
                    }
                });
            }

            await saveState(passed_workspaceId, state, stateFile);
            await saveDequeToWorkspace(passed_workspaceId, tweetCache, "tweetsCache.json");
            // await saveState(passed_workspaceId, Array.from(tickerSet), "tickerSet.json");
        } catch (error) {
            console.error("Error fetching tweets:", error);
            throw new Error(`Failed to fetch tweets: ${error.message}`);
        }
    } while (paginationToken);
};