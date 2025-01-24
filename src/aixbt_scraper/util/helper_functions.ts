import { Deque } from "@datastructures-js/deque";

export function extractTicker(text: string): string | null {
  const match = text.match(/\$[A-Za-z][A-Za-z0-9]*/);
  return match ? match[0].slice(1) : null; // Remove the "$" from the ticker
}

export function pruneDeque(deque) {
  try {
    if (!(deque instanceof Deque)) {
      throw new Error("Invalid data type for deque. Expected a Deque.");
    }

    const cutoffTime = Date.now() - 24 * 60 * 60 * 1000; // 24-hour cutoff
    let prunedCount = 0;

    while (deque.length && deque.front().timestamp < cutoffTime) {
      deque.popFront();
      prunedCount++;
    }

    console.log(`Pruned ${prunedCount} old tweets from the Deque.`);
  } catch (error) {
    console.error(`Error in pruneDeque: ${error.message}`);
    throw error; // Optionally rethrow the error if critical
  }
}

export function updateDeque(deque, newTweets) {
  try {
    if (!(deque instanceof Deque)) {
      throw new Error("Invalid data type for deque. Expected a Deque.");
    }

    let addedCount = 0;

    newTweets.forEach((tweet) => {
      if (tweet && tweet.id && tweet.text && tweet.ticker) {
        deque.pushFront(tweet);
        addedCount++;
        }
       else {
        console.warn("Invalid tweet skipped:", tweet);
      }
    });

    console.log(`Added ${addedCount} new tweets to the Deque.`);
  } catch (error) {
    console.error(`Error in updateDeque: ${error.message}`);
    throw error; // Optionally rethrow the error if critical
  }
}
