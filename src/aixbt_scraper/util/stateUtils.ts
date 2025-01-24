import axios from "axios";
import { agent } from "..";
import { Deque } from '@datastructures-js/deque';

export async function loadState(workspaceId: number, stateFile: string): Promise<any> {
  try {
    // Get the list of files in the workspace
    const files = await agent.getFiles({ workspaceId });
    console.log(`Files in workspace ${workspaceId}:`, files);
    // Find the specific state file
    const file = files.find((file) => file.path === `state/${stateFile}`);
    if (!file) {
      console.log(`State file "${stateFile}" not found.`);
      return null; // No state saved
    }
    console.log(`State file "${stateFile}" loaded successfully.`);
    const state = await fetchStateFromFile(file.fullUrl);
    return state;

  } catch (error) {
    console.error(`Error loading state from "${stateFile}":`, error);
    return null; // Return null if state can't be loaded
  }
}

export async function saveState(workspaceId: number, state: any, stateFile: string): Promise<void> {
  try {
    const filePath = `state/${stateFile}`;

    // Convert state to JSON string and upload as a file
    await agent.uploadFile({
      workspaceId,
      path: filePath,
      file: JSON.stringify(state, null, 2), // Pretty-print for readability
    });

    console.log(`State file "${stateFile}" saved successfully.`);
  } catch (error) {
    console.error(`Error saving state to "${stateFile}":`, error);
    throw new Error(`Failed to save state: ${error.message}`);
  }
}


export async function fetchStateFromFile(url: string): Promise<object | null> {
  try {
    const response = await axios.get(url);
    const state = response.data;

    console.log('State loaded successfully:', state);
    return state;
  } catch (error) {
    console.error('Error fetching state from file:', error);
    return null;
  }
}

// States to save our deque memory:


export async function saveDequeToWorkspace(workspaceId, tweetCache, stateFile) {
  try {
    if (!(tweetCache instanceof Deque)) {
      throw new Error("Invalid data type for tweetCache. Expected a Deque.");
    }

    const dequeAsArray = [...tweetCache]; // Convert Deque to array
    await saveState(workspaceId, dequeAsArray, stateFile);
    console.log("Deque saved to workspace successfully.");
  } catch (error) {
    console.error(`Error saving Deque to workspace: ${error.message}`);
    // Optionally rethrow the error if it should halt the process
    throw new Error(`Failed to save Deque: ${error.message}`);
  }
}


export async function loadDequeFromWorkspace(workspaceId, stateFile) {
  try {
    const dequeState = await loadState(workspaceId, stateFile);
    
    if (!dequeState) {
      console.warn("No saved Deque state found. Initializing an empty Deque.");
      return new Deque();
    }

    if (!Array.isArray(dequeState)) {
      throw new Error("Corrupted state file: Expected an array format.");
    }

    const loadedDeque = new Deque(dequeState); // Rehydrate array into a Deque
    console.log("Deque loaded from workspace successfully.");
    return loadedDeque;
  } catch (error) {
    console.error(`Error loading Deque from workspace: ${error.message}`);
    // Return an empty Deque to ensure the application continues running
    return new Deque();
  }
}