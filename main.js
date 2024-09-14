
require('dotenv').config();
const Web3 = require('web3');
const { Wallet } = require('ethers');
const axios = require('axios');

// Load environment variables
const ALCHEMY_API_KEY = process.env.ALCHEMY_API_KEY;
const SEED_PHRASE = process.env.SEED_PHRASE;
const LOA_TOKEN_ADDRESS = process.env.LOA_TOKEN_CONTRACT_ADDRESS;
const ONEINCH_ROUTER_CONTRACT_ADDRESS = process.env.ONEINCH_ROUTER_CONTRACT_ADDRESS;

// Alchemy Base Mainnet RPC URL
const BASE_RPC_URL = `https://base-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}`;

// Initialize Web3
const web3 = new Web3(BASE_RPC_URL);

// Create wallet using mnemonic
const wallet = Wallet.fromMnemonic(SEED_PHRASE).connect(web3);

const ETH_ADDRESS = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEe'; // ETH address on 1inch

// 1inch API URL for Base network
const API_URL = 'https://api.1inch.io/v5.0/8453/swap'; // 8453 is the chain ID for Base

// CoinGecko API URL for ETH price in USD
const COINGECKO_API_URL = 'https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd';

async function getEthPriceInUsd() {
    try {
        const response = await axios.get(COINGECKO_API_URL);
        return response.data.ethereum.usd;
    } catch (error) {
        console.error(`CoinGecko API error: ${error}`);
        throw error;
    }
}

async function get1inchSwapData(fromToken, toToken, amount, fromAddress) {
    try {
        const params = {
            fromTokenAddress: fromToken,
            toTokenAddress: toToken,
            amount: amount,
            fromAddress: fromAddress,
            slippage: 1, // Slippage tolerance (1%)
            disableEstimate: 'false',
            allowPartialFill: 'false',
        };

        const response = await axios.get(API_URL, { params });
        return response.data;
    } catch (error) {
        console.error(`1inch API error: ${error}`);
        throw error;
    }
}

async function buildAndSendSwapTransaction(fromToken, toToken, amountInWei) {
    try {
        const swapData = await get1inchSwapData(fromToken, toToken, amountInWei.toString(), wallet.address);
        const txData = swapData.tx;

        const tx = {
            to: txData.to,
            value: web3.utils.toWei(txData.value, 'wei'),
            gas: web3.utils.toWei(txData.gas, 'wei'),
            gasPrice: web3.utils.toWei('2', 'gwei'),
            data: txData.data,
        };

        const signedTx = await wallet.signTransaction(tx);
        const txResponse = await web3.eth.sendSignedTransaction(signedTx.rawTransaction);
        console.log(`Transaction sent with hash: ${txResponse.transactionHash}`);
    } catch (error) {
        console.error(`Transaction error: ${error}`);
        throw error;
    }
}

async function sellEthForLoa(amountEth) {
    const amountInWei = web3.utils.toWei(amountEth.toString(), 'ether');
    await buildAndSendSwapTransaction(ETH_ADDRESS, LOA_TOKEN_ADDRESS, amountInWei);
}

async function calculateEthAmount(minUsd, maxUsd) {
    const ethPriceUsd = await getEthPriceInUsd();
    const minEth = minUsd / ethPriceUsd;
    const maxEth = maxUsd / ethPriceUsd;
    return [minEth, maxEth];
}

(async () => {
    const [minEth, maxEth] = await calculateEthAmount(0.06, 0.08);
    const amountEth = minEth + (maxEth - minEth) * 0.5; // Example logic for choosing the amount
    await sellEthForLoa(amountEth);
})();
