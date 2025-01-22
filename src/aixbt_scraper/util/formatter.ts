export function formatMessage(
  points: string[],
  projectData: {
    name: string;
    symbol: string;
    price: string;
    volume: string;
    link: string;
  }): string {
  const { name, symbol, price, volume, link } = projectData;

  const message = `
🚀 **${name} (${symbol})** is trending!
📝 **Key Points**:
- ${points.join('\n- ')}

💰 **Price**: $${price || 'N/A'}
📊 **24h Volume**: $${volume || 'N/A'}
🔗 [View on DexScreener](${link || 'N/A'})
  `.trim();

  return message;
}