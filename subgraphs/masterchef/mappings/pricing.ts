/* eslint-disable prefer-const */
import { BigDecimal, BigInt } from '@graphprotocol/graph-ts'
import { Pair, Token, Bundle, PairCache } from '../generated/schema'
import { ZERO_BD, ONE_BD, TWO_BD } from './helpers'

const WBTT_ADDRESS = '0x8d193c6efa90bcff940a98785d1ce9d093d3dc8a'

const AEB_USDT_WBTT_PAIR = '' // created block ... 
const AEB_DAI_WBTT_PAIR = '' // created block ...
const AB_DAI_WBTT_PAIR = '' // created block ...
const AB_USDT_WBTT_PAIR = '' // created block ...

const BTT_USDT_B_PAIR = '0x5d785035726e285dd869a9a02370bad111479cc3' // created block 12,835,820

let AVERAGE_BTT_PRICE_PRE_STABLES = BigDecimal.fromString('0.00000075')

// Will be ignored in the below function
let AEB_DAI_WBTT_PAIR_BLOCK = BigInt.fromI32(1000000000); // doesnt exist yet
let AB_MIGRATION_CUTOVER_BLOCK = BigInt.fromI32(1000000000); // doesnt exist yet

let BTT_USDT_B_BLOCK = BigInt.fromI32(12835820); 

export function getBTTPriceInUSD(blockNumber: BigInt): BigDecimal {

  if (blockNumber.gt(AB_MIGRATION_CUTOVER_BLOCK)) { // WBTT-DAI.e & WBTT-USDT.e exist

    let abDaiPair = Pair.load(AB_DAI_WBTT_PAIR) // DAI.e is token1
    let abUsdtPair = Pair.load(AB_USDT_WBTT_PAIR) // USDT.e is token1

    let totalLiquidityWBTT = abDaiPair.reserve0.plus(abUsdtPair.reserve0)
    let abDaiWeight = abDaiPair.reserve0.div(totalLiquidityWBTT)
    let abUsdtWeight = abUsdtPair.reserve0.div(totalLiquidityWBTT)

    return abDaiPair.token1Price.times(abDaiWeight).plus(abUsdtPair.token1Price.times(abUsdtWeight))

  } else if (blockNumber.gt(AEB_DAI_WBTT_PAIR_BLOCK)) { // WBTT-USDT & WBTT-DAI exist

    let aebUsdtPair = Pair.load(AEB_USDT_WBTT_PAIR) // USDT is token1
    let aebDaiPair = Pair.load(AEB_DAI_WBTT_PAIR) // DAI is token1

    let totalLiquidityWBTT = aebUsdtPair.reserve0.plus(aebDaiPair.reserve0)
    let aebUsdtWeight = aebUsdtPair.reserve0.div(totalLiquidityWBTT)
    let aebDaiWeight = aebDaiPair.reserve0.div(totalLiquidityWBTT)

    return aebUsdtPair.token1Price.times(aebUsdtWeight).plus(aebDaiPair.token1Price.times(aebDaiWeight))

  } else if (blockNumber.gt(BTT_USDT_B_BLOCK)) { // WBTT-USDT_b exists

    let usdtPair = Pair.load(BTT_USDT_B_PAIR) // USDT_b is token1

    return usdtPair.token1Price

  } else { /* No stable pairs exist */

    return AVERAGE_BTT_PRICE_PRE_STABLES

  }

}

// token where amounts should contribute to tracked volume and liquidity
// tokens listed earlier take precedence for selecting a pair for valuation
// all addresses MUST be lowercase
let WHITELIST: string[] = [
  WBTT_ADDRESS, // WBTT
  '0xf682fbac14efaacb59b20898809b304e86cd3b7d', // QUACK
  '0x9b5f27f6ea9bbd753ce3793a07cba3c74644330d', // USDT_b
]

// minimum liquidity required to count towards tracked volume for pairs with small # of Lps
let MINIMUM_USD_THRESHOLD_NEW_PAIRS = BigDecimal.fromString('1000')

// minimum liquidity for price to get tracked
let MINIMUM_USD_LIQUIDITY_THRESHOLD = BigDecimal.fromString('1000')

/**
 * Search through graph to find derived Eth per token.
 **/
export function findEthPerToken(token: Token): BigDecimal {
  if (token.id == WBTT_ADDRESS) {
    return ONE_BD
  }
  // loop through whitelist and check if paired with any
  for (let i = 0; i < WHITELIST.length; ++i) {
    let pairCache = PairCache.load(token.id + WHITELIST[i])
    if (pairCache !== null) {
      let pair = Pair.load(pairCache.pair)
      if (pair.reserveUSD.gt(MINIMUM_USD_LIQUIDITY_THRESHOLD)) {
        if (pair.token0 == token.id) {
          let token1 = Token.load(pair.token1)
          return pair.token1Price.times(token1.derivedETH as BigDecimal) // return token1 per our token * BTT per token 1
        }
        if (pair.token1 == token.id) {
          let token0 = Token.load(pair.token0)
          return pair.token0Price.times(token0.derivedETH as BigDecimal) // return token0 per our token * BTT per token 0
        }
      }
    }
  }
  return ZERO_BD // nothing was found return 0
}

/**
 * Accepts tokens and amounts, return tracked amount based on token whitelist
 * If one token on whitelist, return amount in that token converted to USD.
 * If both are, return average of two amounts
 * If neither is, return 0
 */
export function getTrackedVolumeUSD(
  tokenAmount0: BigDecimal,
  token0: Token,
  tokenAmount1: BigDecimal,
  token1: Token,
  pair: Pair
): BigDecimal {
  let bundle = Bundle.load('1')
  let price0 = token0.derivedETH.times(bundle.ethPrice)
  let price1 = token1.derivedETH.times(bundle.ethPrice)

  // if less than 5 LPs, require high minimum reserve amount or return 0
  if (pair.liquidityProviderCount.lt(BigInt.fromI32(5))) {
    let reserve0USD = pair.reserve0.times(price0)
    let reserve1USD = pair.reserve1.times(price1)
    if (WHITELIST.includes(token0.id) && WHITELIST.includes(token1.id)) {
      if (reserve0USD.plus(reserve1USD).lt(MINIMUM_USD_THRESHOLD_NEW_PAIRS)) {
        return ZERO_BD
      }
    }
    if (WHITELIST.includes(token0.id) && !WHITELIST.includes(token1.id)) {
      if (reserve0USD.times(TWO_BD).lt(MINIMUM_USD_THRESHOLD_NEW_PAIRS)) {
        return ZERO_BD
      }
    }
    if (!WHITELIST.includes(token0.id) && WHITELIST.includes(token1.id)) {
      if (reserve1USD.times(TWO_BD).lt(MINIMUM_USD_THRESHOLD_NEW_PAIRS)) {
        return ZERO_BD
      }
    }
  }

  // both are whitelist tokens, take average of both amounts
  if (WHITELIST.includes(token0.id) && WHITELIST.includes(token1.id)) {
    return tokenAmount0
      .times(price0)
      .plus(tokenAmount1.times(price1))
      .div(TWO_BD)
  }

  // take full value of the whitelisted token amount
  if (WHITELIST.includes(token0.id) && !WHITELIST.includes(token1.id)) {
    return tokenAmount0.times(price0)
  }

  // take full value of the whitelisted token amount
  if (!WHITELIST.includes(token0.id) && WHITELIST.includes(token1.id)) {
    return tokenAmount1.times(price1)
  }

  // neither token is on white list, tracked volume is 0
  return ZERO_BD
}

/**
 * Accepts tokens and amounts, return tracked amount based on token whitelist
 * If one token on whitelist, return amount in that token converted to USD * 2.
 * If both are, return sum of two amounts
 * If neither is, return 0
 */
export function getTrackedLiquidityUSD(
  tokenAmount0: BigDecimal,
  token0: Token,
  tokenAmount1: BigDecimal,
  token1: Token,
  bttPrice: BigDecimal
): BigDecimal {
  let price0 = token0.derivedETH.times(bttPrice)
  let price1 = token1.derivedETH.times(bttPrice)

  // both are whitelist tokens, take average of both amounts
  if (WHITELIST.includes(token0.id) && WHITELIST.includes(token1.id)) {
    return tokenAmount0.times(price0).plus(tokenAmount1.times(price1))
  }

  // take double value of the whitelisted token amount
  if (WHITELIST.includes(token0.id) && !WHITELIST.includes(token1.id)) {
    return tokenAmount0.times(price0).times(TWO_BD)
  }

  // take double value of the whitelisted token amount
  if (!WHITELIST.includes(token0.id) && WHITELIST.includes(token1.id)) {
    return tokenAmount1.times(price1).times(TWO_BD)
  }

  // neither token is on white list, tracked volume is 0
  return ZERO_BD
}
