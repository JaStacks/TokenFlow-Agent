import axios from 'axios';

export async function getProjectLinks(ticker: string) {
  try {
    // Fetch data from DexScreener API
    const response = await axios.get(`https://api.dexscreener.com/latest/dex/search?q=${ticker}`);
    const pairs = response?.data?.pairs || [];

    // Extract relevant information for each pair
    const projects = pairs.map((pair: any) => {
      try{

      const dexScreenerLink = pair.url;
      const projectTwitterLink = pair.info?.socials?.find((social: any) => social.type === "twitter")?.url || null;
      const projectTelegramLink = pair.info?.socials?.find((social: any) => social.type === "telegram")?.url || null;
      const projectWebsites = pair.info?.websites?.map((website: any) => website.url) || [];

      return {
        dexScreenerLink,
        projectTwitterLink,
        projectTelegramLink,
        projectWebsites,
        baseTokenName: pair.baseToken?.name || 'Unknown Token Name',
        baseTokenSymbol: pair.baseToken?.symbol || 'Unknown Token Symbol',
        chainId: pair.chainId || 'Unknown Chain ID',
        dexId: pair.dexId ||  'Unknown DEX ID',
        liquidity: pair.liquidity?.usd || 0,
        priceUsd: pair.priceUsd || 0,
        volume24h: pair.volume?.h24 || 0,
      };
    }
    catch(err){
      console.error(`Error fetching project links for ticker ${ticker}:`, err);
      return null;
    }
  }).filter((project) => project !== null);

    // Return projects
    return projects;
  } catch (error) {
    console.error(`Error fetching project links for ticker ${ticker}:`, error);
    return [];
  }
}

export async function getBestProjectMatch(ticker: string) {

  try {
    console.log(`Fetching project data for ticker: ${ticker}`);
    const projects = await getProjectLinks(ticker);

    if (!projects || projects.length === 0) {
      console.log(`No projects found for ticker: ${ticker}`);
      return null;
    }

    // Select the project with the highest 24hr volume
    const bestProject = projects.reduce((max, project) =>
      project.volume24h > max.volume24h ? project : max
    );

    console.log(`Best project for ticker ${ticker}:`, bestProject);

    return JSON.stringify(bestProject);
  } catch (error) {
    console.error(`Error fetching project data for ticker ${ticker}:`, error);
    return null;
  }
}

