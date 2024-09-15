import { Injectable, Logger } from '@nestjs/common';
import {
  Account,
  Aptos,
  AptosConfig,
  Network,
  TransactionResponse,
} from '@aptos-labs/ts-sdk';

@Injectable()
export class AptosService {

  // How to add other contract events to the score

  // 1. Make a test transaction to find their contract
  // 2. Check the tx events on https://explorer.aptoslabs.com/
  // 3. Add event to standardizeEventData:
  // If it shows the sender address in the same event which has the coin info and amount, then write the mapping in standardizeEventData
  // If it does not show the sender address, then you have to first fetchSenderFromCoinRegister, and then map that in standardizeEventData
  // 4. Add calculations to score function

  async getTxFromIndexer(timestamp?: number) {
    const fallbackTimestamp = 1725148801; // Fallback to 1st Sept if no timestamp is provided
    const effectiveTimestamp = timestamp || fallbackTimestamp;

    const contractFunctions = [
      // Aries Lending
      '0x9770fa9c725cbd97eb50b2be5f7416efdfd1f1554beb0750d4dae4c64e860da3::controller::DepositEvent',
      '0x9770fa9c725cbd97eb50b2be5f7416efdfd1f1554beb0750d4dae4c64e860da3::controller::WithdrawEvent',

      // Aries Swap
      `0xec42a352cc65eca17a9fa85d0fc602295897ed6b8b8af6a6c79ef490eb8f9eba::amm_swap::SwapEvent`,

      // Aries Trading
      '0xc0deb00c405f84c85dc13442e305df75d1288100cdd82675695f6148c7ece51c::user::PlaceLimitOrderEvent',

      // Amnis Staking https://stake.amnis.finance/
      '0x111ae3e5bc816a5e63c2da97d0aa3886519e0cd5e4b046659fa35796bd11542a::router::MintEvent', // This event is tracking the deposit_entry function
      '0x111ae3e5bc816a5e63c2da97d0aa3886519e0cd5e4b046659fa35796bd11542a::stapt_token::MintEvent', // This event is tracking the stake function
      '0x163df34fccbf003ce219d3f1d9e70d140b60622cb9dd47599c25fb2f797ba6e::liquidity_pool::SwapEvent', // This event is tracking the swap function
    
      // Cellana https://app.cellana.finance/
      '0x4bf51972879e3b95c4781a5cdcb9e1ee24ef483e7d22f2d903626f126df62bd1::liquidity_pool::SwapEvent', // Swap event
      '0x4bf51972879e3b95c4781a5cdcb9e1ee24ef483e7d22f2d903626f126df62bd1::liquidity_pool::AddLiquidityEvent', // LP event
 
      // Echelon https://app.echelon.market/dashboard
      '0xc6bc659f1649553c1a3fa05d9727433dc03843baac29473c817d06d39e7621ba::lending::SupplyEvent', // Lending event
      '0xc6bc659f1649553c1a3fa05d9727433dc03843baac29473c817d06d39e7621ba::lending::BorrowEvent', // Borrowing event
      `0x48271d39d0b05bd6efca2278f22277d6fcc375504f9839fd73f74ace240861af::weighted_pool::SwapEvent`, // Swap event

      // Liquid https://liquidswap.com/
      '0x190d44266241744264b964a37b8f09863167a12d3e70cda39376cfb4e3561e12::liquidity_pool::SwapEvent', // Swap event
      '0x190d44266241744264b964a37b8f09863167a12d3e70cda39376cfb4e3561e12::liquidity_pool::LiquidityAddedEvent',  // Add LP event
 
      // Thala https://app.thala.fi/overview
      '0x48271d39d0b05bd6efca2278f22277d6fcc375504f9839fd73f74ace240861af::weighted_pool::SwapEvent', // Swap event
      '0x48271d39d0b05bd6efca2278f22277d6fcc375504f9839fd73f74ace240861af::weighted_pool::AddLiquidityEvent', // Add LP event
        
    ];

    const transactionsData = await this.fetchTransactions(contractFunctions, effectiveTimestamp);
    console.log('Received transactions data:', transactionsData);

    const standardizedData = await this.standardizeEventData(transactionsData.events);
    console.log('Standardized Event Data:', JSON.stringify(standardizedData, null, 2));

    // Calculate community scores based on the standardized events
    const communityScores = await this.calculateOnchainCommunityScore(standardizedData);
    console.log('Community Scores:', JSON.stringify(communityScores, null, 2));

    return communityScores;
  }

  async fetchTransactions(contractFunctions, maxTimestamp: number) {
    const endpoint = process.env.APTOS_GRAPHQL_ENDPOINT;

    const filters = contractFunctions.map(func => {
      if (func.includes('DepositEvent') || func.includes('WithdrawEvent') || func.includes('liquidity_pool::LiquidityAddedEvent') || func.includes('weighted_pool::SwapEvent') || func.includes('weighted_pool::AddLiquidityEvent')) {
        return `{ indexed_type: { _like: "${func}<%" } }`; // Wildcard for Deposit and Withdraw because they come with "<>coin" attached
      } else if (func.includes('liquidity_pool::SwapEvent')) {
        return `{ indexed_type: { _like: "${func}%" } }`;
      } else {
        return `{ indexed_type: { _like: "${func}" } }`;
      }
    });
  
    const orCondition = filters.join(', ');

    let offset = 0;
    let totalEvents = [];

    while (true) {
      const query = `
        query MyQuery {
          events(
            offset: ${offset}
            order_by: { transaction_version: desc }
            where: { 
              _or: [${orCondition}],
              transaction_version: { _lte: ${maxTimestamp} }
            }
          ) {
            account_address
            creation_number
            data
            event_index
            indexed_type
            sequence_number
            transaction_block_height
            transaction_version
            type
          }
        }
      `;

      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ query }),
        });
    
        const result = await response.json();
    
        if (result.errors) {
          console.error('GraphQL Query Error:', result.errors);
          throw new Error('Failed to fetch events');
        }
    
        const events = result.data?.events || [];
        console.log('Fetched Events:', JSON.stringify(events, null, 2));

        totalEvents = [...totalEvents, ...events];
        console.log('Total events fetched:', totalEvents.length);

        if (events.length < 100) {
          break; // No more events to fetch
        }
  
        offset += 100;
      } catch (error) {
        console.error('Error fetching transactions and events:', error);
        throw error;
      }
    }
    // Step 2: Fetch sender addresses for Mint and Swap events
    const mintEvents = totalEvents.filter(event => 
      event.indexed_type.includes('0x111ae3e5bc816a5e63c2da97d0aa3886519e0cd5e4b046659fa35796bd11542a::router::MintEvent') || event.indexed_type.includes('0x111ae3e5bc816a5e63c2da97d0aa3886519e0cd5e4b046659fa35796bd11542a::stapt_token::MintEvent')
    );

    const swapEvents = totalEvents.filter(event => 
      event.indexed_type.includes('0xec42a352cc65eca17a9fa85d0fc602295897ed6b8b8af6a6c79ef490eb8f9eba::amm_swap::SwapEvent') || 
      event.indexed_type.includes('liquidity_pool::SwapEvent') || event.indexed_type.includes('weighted_pool::SwapEvent') || 
      event.indexed_type.includes('0x190d44266241744264b964a37b8f09863167a12d3e70cda39376cfb4e3561e12::liquidity_pool::LiquidityAddedEvent') ||
      event.indexed_type.includes('0x48271d39d0b05bd6efca2278f22277d6fcc375504f9839fd73f74ace240861af::weighted_pool::AddLiquidityEvent')
    );

    // Fetch sender addresses for Mint events
    const mintEventsWithSenders = await Promise.all(
      mintEvents.map(async (mintEvent) => {
        const mintSenderAddress = await this.fetchSenderFromCoinRegister(mintEvent.transaction_version, mintEvent.type);
        console.log(`Transaction version ${mintEvent.transaction_version} has sender address: ${mintSenderAddress}`);
        
        return {
          ...mintEvent,
          mintSenderAddress: mintSenderAddress
        };
      })
    );

    // Fetch sender addresses for Swap events
    const swapEventsWithSenders = await Promise.all(
      swapEvents.map(async (swapEvent) => {
        const swapSenderAddress = await this.fetchSenderFromCoinRegister(swapEvent.transaction_version, swapEvent.type);
        console.log(`Transaction version ${swapEvent.transaction_version} has sender address: ${swapSenderAddress}`);
        
        return {
          ...swapEvent,
          swapSenderAddress: swapSenderAddress
        };
      })
    );
    // console.log('Swap events with sender addresses:', JSON.stringify(swapEventsWithSenders, null, 2));

    const combinedEvents = [...totalEvents, ...mintEventsWithSenders, ...swapEventsWithSenders];

    // Step 2: Extract coin addresses from the events
    const coinAddresses = new Set();
    combinedEvents.forEach(event => {
      if (event.data.coin_a_info) {
        coinAddresses.add(event.data.coin_a_info.account_address);
      }
      if (event.data.coin_b_info) {
        coinAddresses.add(event.data.coin_b_info.account_address);
      }
    });

    const coinAddressesList = Array.from(coinAddresses);
    console.log('Detected Coin Addresses:', JSON.stringify(coinAddressesList, null, 2));

    // Fetch coin information based on the coin addresses
    const coinInfoPromises = coinAddressesList.map(address => this.fetchCoinInfo(address));
    const coinInfoList = await Promise.all(coinInfoPromises);

    // Flatten the coinInfoList if necessary
    const flattenedCoinInfoList = coinInfoList.flat();
    console.log('Fetched Coin Information:', JSON.stringify(flattenedCoinInfoList, null, 2));

    return {
      events: combinedEvents,
      coinInfoList: flattenedCoinInfoList,
    };
  } catch (error) {
    console.error('Error fetching transactions and events:', error);
    throw error;
  }

  // We need this function to get a sender per Swap event
  async fetchSenderFromCoinRegister(transactionVersion, eventType) {
    const endpoint = process.env.APTOS_GRAPHQL_ENDPOINT;

    let indexedType = '';
    if (eventType.includes('SwapEvent') || eventType.includes('liquidity_pool::LiquidityAddedEvent') || eventType.includes('weighted_pool::AddLiquidityEvent')) {
      // indexedType = '0x1::account::CoinRegisterEvent';
      indexedType = '0x1::coin::WithdrawEvent';
    } else if (eventType.includes('MintEvent')) {
      indexedType = '0x1::coin::WithdrawEvent';
    }
  
    const query = `
      query MyQuery {
        events(
          limit: 1
          offset: 0
          order_by: { transaction_version: desc }
          where: { 
            indexed_type: { _like: "${indexedType}" },
            transaction_version: { _eq: ${transactionVersion} }
          }
        ) {
          account_address
          transaction_version
        }
      }
    `;
  
    const retries = 3; // Number of retries
    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ query }),
        });

        const result = await response.json();

        if (result.errors) {
          console.error('GraphQL Query Error:', result.errors);
          throw new Error('Failed to fetch CoinRegisterEvent');
        }

        const coinRegisterEvent = result.data?.events?.[0];
        return coinRegisterEvent ? coinRegisterEvent.account_address : null;
      } catch (error) {
        console.error(`Error fetching sender from CoinRegisterEvent (attempt ${attempt + 1}):`, error.message);
        if (attempt < retries - 1) {
          const waitTime = Math.pow(2, attempt) * 1000; // Exponential backoff
          console.log(`Retrying in ${waitTime / 1000} seconds...`);
          await new Promise(resolve => setTimeout(resolve, waitTime)); // Wait before retrying
        } else {
          console.error(`Failed to fetch sender after ${retries} attempts.`);
          return null; // Return null if all retries fail
        }
      }
    }
  }

  async fetchCoinInfo(coinAddress) {
    const endpoint = process.env.APTOS_GRAPHQL_ENDPOINT;

    const query = `
      query MyCoinInfoQuery {
        coin_infos(
          limit: 1
          where: { coin_type: { _like: "${coinAddress}:%" } }
        ) {
          coin_type
          coin_type_hash
          creator_address
          decimals
          name
          supply_aggregator_table_handle
          supply_aggregator_table_key
          symbol
          transaction_created_timestamp
          transaction_version_created
        }
      }
    `;

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query }),
      });

      const result = await response.json();

      if (result.errors) {
        console.error('GraphQL Coin Info Query Error:', result.errors);
        throw new Error('Failed to fetch coin info');
      }

      return result.data?.coin_infos || [];
    } catch (error) {
      console.error('Error fetching coin info:', error);
      throw error;
    }
  }

  async standardizeEventData(events) {
    const standardizedEvents = [];
  
    for (const event of events) {
      const eventData = event.data;
  
      let inputAmount = 0;
      let outputAmount = 0;
      let inputCoin = '';
      let outputCoin = '';
      let type = event.indexed_type;
      let accountAddress = '';
  
      // Standardize event data based on the indexed type
      if (event.indexed_type.includes('WithdrawEvent')) {
        inputAmount = parseInt(eventData.amount_in || 0);
        outputAmount = parseInt(eventData.withdraw_amount || 0);
        outputCoin = event.indexed_type.split('<')[1].split('>')[0]; // Extracts the coin type from the event name
        inputCoin = ''; // No inputCoin coin for withdrawal
        type = event.indexed_type;
        accountAddress = eventData.sender;
  
      } else if (event.indexed_type.includes('DepositEvent')) {
        inputAmount = parseInt(eventData.amount_in || 0);
        outputAmount = parseInt(eventData.deposit_amount || 0);
        inputCoin = event.indexed_type.split('<')[1].split('>')[0]; // Extracts the coin type from the event name
        outputCoin = ''; // No outputCoin coin for deposit
        type = event.indexed_type;
        accountAddress = eventData.sender;
  
      } else if (event.indexed_type.includes('amm_swap')) {
        inputAmount = parseInt(eventData.a_in || 0);
        outputAmount = parseInt(eventData.b_out || 0);
        inputCoin = eventData.coin_a_info.account_address; // Using the coin info structure
        outputCoin = eventData.coin_b_info.account_address;
        type = event.indexed_type;
        accountAddress = event.swapSenderAddress;
  
      } else if (event.indexed_type.includes('PlaceLimitOrderEvent')) {
        inputAmount = parseInt(eventData.size || 0);
        outputAmount = 0;
        type = event.indexed_type;
        accountAddress = event.account_address;
  
      } else if (event.indexed_type.includes('stapt_token::MintEvent')) {
        inputAmount = parseInt(eventData.apt || 0);
        outputAmount = parseInt(eventData.amapt || 0);
        inputCoin = 'APT';
        outputCoin = 'SAPT';
        type = event.indexed_type;
        accountAddress = event.mintSenderAddress;
        // console.log('eventData:', JSON.stringify(event, null, 2));
  
      } else if (event.indexed_type.includes('router::MintEvent')) {
        inputAmount = parseInt(eventData.amount || 0);
        inputCoin = 'SAPT';
        outputCoin = '';
        type = event.indexed_type;
        accountAddress = event.mintSenderAddress;
        // console.log('eventData:', JSON.stringify(event, null, 2));
  
      } else if (event.indexed_type.includes('0x163df34fccbf003ce219d3f1d9e70d140b60622cb9dd47599c25fb2f797ba6e::liquidity_pool::SwapEvent')) {
        inputAmount = eventData.y_in ? parseInt(eventData.y_in) : parseInt(eventData.x_in || 0);
        outputAmount = eventData.x_out ? parseInt(eventData.x_out) : parseInt(eventData.y_out || 0);
        inputCoin = event.indexed_type.split('<')[1].split(',')[0];
        outputCoin = event.indexed_type.split(',')[1].split('>')[0];
        type = event.indexed_type;
        accountAddress = event.swapSenderAddress;
  
      } else if (event.indexed_type.includes('0x4bf51972879e3b95c4781a5cdcb9e1ee24ef483e7d22f2d903626f126df62bd1::liquidity_pool::SwapEvent')) {
        inputAmount = eventData.amount_in;
        outputAmount = eventData.amount_out;
        inputCoin = eventData.from_token;
        outputCoin = eventData.to_token;
        type = event.indexed_type;
        accountAddress = event.swapSenderAddress;

      } else if (event.indexed_type.includes('0x4bf51972879e3b95c4781a5cdcb9e1ee24ef483e7d22f2d903626f126df62bd1::liquidity_pool::AddLiquidityEvent')) {
        inputAmount = parseInt(eventData.amount_1 || 0);
        outputAmount = parseInt(eventData.amount_2 || 0);
        // inputCoin = eventData.from_token;
        // outputCoin = eventData.to_token;
        type = event.indexed_type;
        accountAddress = eventData.lp;

      } else if (event.indexed_type.includes('SupplyEvent')) {
        inputAmount = parseInt(eventData.amount || 0);
        outputAmount = 0;
        // inputCoin = 'APT';
        outputCoin = '';
        accountAddress = eventData.account_addr;
  
      } else if (event.indexed_type.includes('BorrowEvent')) {
        inputAmount = parseInt(eventData.amount || 0);
        outputAmount = 0;
        // inputCoin = 'APT';
        outputCoin = '';
        accountAddress = eventData.account_addr;
  
      } else if (event.indexed_type.includes('weighted_pool::SwapEvent')) {
        inputAmount = parseInt(eventData.amount_in || 0);
        inputAmount = parseInt(eventData.amount_out || 0);
        inputCoin = eventData.from_token;
        outputCoin = eventData.to_token;
        accountAddress = event.swapSenderAddress;
  
      } else if (event.indexed_type.includes('0x190d44266241744264b964a37b8f09863167a12d3e70cda39376cfb4e3561e12::liquidity_pool::SwapEvent')) {
        inputAmount = parseInt(eventData.added_x_val || 0);
        outputAmount = parseInt(eventData.added_y_val || 0);
        inputCoin = eventData.from_token;
        outputCoin = eventData.to_token;
        type = event.indexed_type;
        accountAddress = event.swapSenderAddress;

      } else if (event.indexed_type.includes('liquidity_pool::LiquidityAddedEvent')) {
        inputAmount = parseInt(eventData.added_x_val || 0);
        outputAmount = parseInt(eventData.added_y_val || 0);
        inputCoin = event.indexed_type.split('<')[1].split(',')[0];
        outputCoin = event.indexed_type.split(',')[1].split('>')[0];
        type = event.indexed_type;
        accountAddress = event.swapSenderAddress;

      } else if (event.indexed_type.includes('0x48271d39d0b05bd6efca2278f22277d6fcc375504f9839fd73f74ace240861af::weighted_pool::AddLiquidityEvent')) {
        inputAmount = parseInt(eventData.amount_0 || 0);
        outputAmount = parseInt(eventData.amount_1 || 0);
        inputCoin = event.indexed_type.split('<')[1].split(',')[0];
        outputCoin = event.indexed_type.split(',')[1].split('>')[0];
        type = event.indexed_type;
        accountAddress = event.swapSenderAddress;

      } else {
        // Handle any other types if necessary
        console.warn(`Unhandled event type: ${event.indexed_type}`);
      }
  
      standardizedEvents.push({
        account_address: accountAddress,
        input_amount: inputAmount,
        output_amount: outputAmount,
        input_coin: inputCoin,
        output_coin: outputCoin,
        type: type
      });
    }
  
    return standardizedEvents;
  }

  async calculateOnchainCommunityScore(events) {
    const scoreMap = {};
  
    events.forEach(event => {
      const accountAddress = event.account_address;
      const inputAmount = parseInt(event.input_amount || 0);
      const outputAmount = parseInt(event.output_amount || 0);
      const type = event.type;
  
      // Initialize score if not present
      if (!scoreMap[accountAddress]) {
        scoreMap[accountAddress] = 0;
      }
  
      // Apply score based on event type (simulating deposit, withdrawal, swap, mint)
      if (type.includes('amm_swap')) {
        scoreMap[accountAddress] += 100; // Base score for swap events
      } else if (type.includes('DepositEvent')) {
        scoreMap[accountAddress] += 50;  // Deposit
      } else if (type.includes('WithdrawEvent')) {
        scoreMap[accountAddress] += 50;  // Withdrawal
      } else if (type.includes('liquidity_pool::SwapEvent')) {
        scoreMap[accountAddress] += 80; // Base score for liquidity pool swap
        if (inputAmount > 50000) {
          scoreMap[accountAddress] += 20; // Bonus for larger swaps
        }
        if (outputAmount > 50000) {
          scoreMap[accountAddress] += 20; // Bonus for larger outputs
        }
      } else if (type.includes('liquidity_pool::LiquidityAddedEvent')) {
        scoreMap[accountAddress] += 70; // Base score for adding liquidity
        if (inputAmount > 100000) {
          scoreMap[accountAddress] += 30; // Bonus for large liquidity addition
        }
      } else if (type.includes('weighted_pool::AddLiquidityEvent')) {
        scoreMap[accountAddress] += 70; // Base score for adding liquidity
        if (inputAmount > 100000) {
          scoreMap[accountAddress] += 30; // Bonus for large liquidity addition
        }
      } else if (type.includes('weighted_pool::SwapEvent')) {
        scoreMap[accountAddress] += 80; // Base score for liquidity pool swap
        if (inputAmount > 50000) {
          scoreMap[accountAddress] += 20; // Bonus for larger swaps
        }
        if (outputAmount > 50000) {
          scoreMap[accountAddress] += 20; // Bonus for larger outputs
        }
      } else if (type.includes('MintEvent')) {
        scoreMap[accountAddress] += 75; // Base score for MintEvent
        if (inputAmount > 100000) {
          scoreMap[accountAddress] += 50; // Bonus for large minting
        }
      } else if (type.includes('SupplyEvent')) {
        scoreMap[accountAddress] += 60; // Base score for SupplyEvent
        if (inputAmount > 100000) {
          scoreMap[accountAddress] += 20; // Bonus for large supply amounts
        }
      } else if (type.includes('BorrowEvent')) {
        scoreMap[accountAddress] += 50; // Base score for BorrowEvent
        if (inputAmount > 100000) {
          scoreMap[accountAddress] += 20; // Bonus for large borrow amounts
        }
      }
  
      // Special processing for large transactions
      if (event.input_coin === '0x1::aptos_coin::AptosCoin' && inputAmount > 100000) {
        scoreMap[accountAddress] += 100; // Bonus for large AptosCoin deposits
      }
      if (event.output_coin === '0x1::aptos_coin::AptosCoin' && outputAmount > 100000) {
        scoreMap[accountAddress] += 100; // Bonus for large AptosCoin withdrawals
      }
    });
  
    // Filter out 'undefined' and 'null' keys
    const filteredScores = Object.fromEntries(
      Object.entries(scoreMap).filter(([key, value]) => key !== 'undefined' && key !== 'null')
    );

    // Save community scores to the database
    await this.saveCommunityScores(filteredScores);

    return filteredScores;
  }

  async saveCommunityScores(communityScores) {
    // Save each score to the database
    for (const [address, score] of Object.entries(communityScores)) {
      // Ensure score is a number, default to 0 if undefined or null
      const numericScore = typeof score === 'number' ? score : (Number(score) || 0);
  
      try {
        await this.saveToDb.update({
          where: { address: address },
          update: { CommunityScore: numericScore }, // Ensure communityScore is a number
          create: { address: address, CommunityScore: numericScore }, // Ensure communityScore is a number
        });
        this.logger.log(`Saved community score for address ${address}: ${numericScore}`);
      } catch (error) {
        this.logger.error(`Error saving community score for address ${address}: ${error.message}`);
      }
    }
  }

}
