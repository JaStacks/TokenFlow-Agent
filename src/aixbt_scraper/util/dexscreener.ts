import axios from "axios";

export async function getBestProjectMatch(ticker: string) {
  try {
    console.log(`Fetching project data for ticker: ${ticker}`);
    const projects = await getProjectLinks(ticker);

    if (!projects || projects.length === 0) {
      console.log(`No projects found for ticker: ${ticker}`);
      return null;
    }

    console.log(`Projects found for ticker ${ticker}:`, projects);

    // Step 1: Exact Match
    const exactMatches = projects.filter(
      (project) =>
        project.baseTokenSymbol.toLowerCase() === ticker.toLowerCase() ||
        project.baseTokenName.toLowerCase().includes(ticker.toLowerCase())
    );

    if (exactMatches.length > 0) {
      console.log(`Exact matches found for ticker ${ticker}:`, exactMatches);

      // Sort exact matches by liquidity
      exactMatches.sort((a, b) => b.liquidity - a.liquidity);

      return exactMatches[0]; // Return the top exact match
    }

    // Step 2: Sort by liquidity (fallback if no exact match)
    const sortedProjects = projects.sort((a, b) => b.liquidity - a.liquidity);

    console.log(`Top project by liquidity for ${ticker}:`, sortedProjects[0]);

    return sortedProjects[0]; // Use the top-ranked project
  } catch (error) {
    console.error(`Error fetching project data for ticker ${ticker}:`, error);
    return null;
  }
}

export async function getProjectLinks(ticker: string) {
  try {
    // Fetch data from DexScreener API
    const response = await axios.get(`https://api.dexscreener.com/latest/dex/search?q=${ticker}`);
    const pairs = response?.data?.pairs || [];

    // Extract relevant information for each pair
    const projects = pairs.map((pair: any) => {
      const dexScreenerLink = pair.url;
      const projectTwitterLink = pair.info?.socials?.find((social: any) => social.type === "twitter")?.url || null;
      const projectWebsite = pair.info?.websites?.[0]?.url || null;

      return {
        dexScreenerLink,
        projectTwitterLink,
        projectWebsite,
        baseTokenName: pair.baseToken.name,
        baseTokenSymbol: pair.baseToken.symbol,
        chainId: pair.chainId,
        liquidity: pair.liquidity.usd,
        priceUsd: pair.priceUsd,
        volume24h: pair.volume.h24,
      };
    });

    return projects;
  } catch (error) {
    console.error(`Error fetching project links for ticker ${ticker}:`, error);
    return [];
  }
}
