interface Project {
  baseTokenName: string;
  baseTokenSymbol: string;
  chainId: string;
  dexId: string;
  priceUsd: string;
  liquidity: string;
  volume24h: string;
  dexScreenerLink: string;
  projectTwitterLink: string;
  projectTelegramLink: string;
  projectWebsites: string;
}

export function formatMessage(textArray: string[], project: Project): string {
  return textArray
    .map((text) => {
      return `🚀 Project Details:
- Name: ${project.baseTokenName} (${project.baseTokenSymbol})
- Chain: ${project.chainId}
- DEX: ${project.dexId}
- Price: ${project.priceUsd}
- Liquidity: ${project.liquidity}
- 24h Volume: ${project.volume24h}

🔗 Links:
- DexScreener: ${project.dexScreenerLink}
- Twitter: ${project.projectTwitterLink}
- Telegram: ${project.projectTelegramLink}
- Websites: ${project.projectWebsites}

📝 Context:
${text}`;
    })
    .join('\n\n');
}
