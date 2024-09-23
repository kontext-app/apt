[Aptos.fyi](https://aptos.fyi) shows the most relevant news from Aptos Twitter, by decentralizing the feed AI layer.

## What problem is this solving?

Twitter is _the_ central platform for online conversation about crypto (and a lot of global discussions, from sports to science, tech and politics). The problem is that it's hard to discover good content. The feed is a mess. The signal-to-noise ratio is low. And the only tool Twitter gives you as a solution are Twitter lists, which don't scale well as they only sort by time.

Aptos.fyi solves this problem, by allowing any community to host their own AI-curated feed.

And to serve both offchain and onchain community members, Aptos.fyi allows anyone to propose and implement new algorithms, through Twitter and through Aptos onchain voting.

Aptos.fyi decentralizes AI curation, on Aptos.
Aptos.fyi solves AI alignment, on Aptos.

## Tech: Aptos + Nodit + Extension

Our stack is Next.js for the frontend, Node.js for the backend, and we are hosting our voting contracts on Aptos testnet. The Aptos contract allows our users to propose and vote on new accounts for the Aptos community list, adn to propose new variable settings as input to our feed AI.

Building on Aptos allows us to leverage a highly scalable and efficient blockchain infrastructure, enabling our users to vote in realtime. This ensures that our AI-curated feeds can operate seamlessly, providing real-time updates and interactions for community members.

We also built a chrome extension to lets community members propose new accounts for their community list, directly from the Twitter UI:

<img width="615" alt="image" src="https://github.com/user-attachments/assets/bc1b7b55-8d63-48e8-8d08-ebeab11a72a1">


## Development

### How to get scores for the most active Aptos users

  1. Check the [explorer](https://aptos-explorer.xangle.io/blocks/228872725/block) for a blockheight that's about a day old, and curl this to get the "first_version":
  ```
  curl --request GET  \
       --url https://aptos-mainnet.nodit.io/v1/blocks/by_height/228691737 \
       --header 'X-API-KEY: YOUR_API_KEY'   \
       --header 'accept: application/json'
  ```
  2. Do the same for the most recent block.
  3. Query `/index-top-aptos-addresses?smallTransactionVersion=123&highTransactionVersion=456`

### How to add contracts

  1. Make a test transaction to find the contract
  2. Check the tx events on an [explorer](https://explorer.aptoslabs.com/)
  3. Add event to standardizeEventData:
  If it shows the sender address in the same event which has the coin info and amount, then write the mapping in standardizeEventData
  If it does not show the sender address, then you have to first fetchSenderFromCoinRegister, and then map that in standardizeEventData
  4. Add calculations to score function



Contact as at 
