import fs from 'fs';

// Define the path to the state file
const stateFilePath = './state.json';

/**
 * Load state from the state file.
 * @returns The state object.
 */
export function loadState(): { lastProcessedId: string | null; processedTickers: string[] } {
  if (fs.existsSync(stateFilePath)) {
    try {
      const data = fs.readFileSync(stateFilePath, 'utf-8');
      return JSON.parse(data);
    } catch (error) {
      console.error('Error reading state file:', error);
      return { lastProcessedId: null, processedTickers: [] };
    }
  }
  return { lastProcessedId: null, processedTickers: [] };
}

/**
 * Save state to the state file.
 * @param state The state object to save.
 */
export function saveState(state: { lastProcessedId: string | null; processedTickers: string[] }) {
  try {
    fs.writeFileSync(stateFilePath, JSON.stringify(state, null, 2));
    console.log('State saved successfully.');
  } catch (error) {
    console.error('Error saving state:', error);
  }
}

/**
 * Update the state with the last processed ID and a new ticker.
 * @param lastProcessedId The ID of the last processed tweet.
 * @param ticker The new ticker to add to the state.
 */
export function updateState(lastProcessedId: string, ticker: string) {
  const state = loadState();
  state.lastProcessedId = lastProcessedId;
  if (!state.processedTickers.includes(ticker)) {
    state.processedTickers.push(ticker);
  }
  saveState(state);
}
