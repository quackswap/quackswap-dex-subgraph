/* eslint-disable prefer-const */
import { BigInt, BigDecimal, Address, log } from "@graphprotocol/graph-ts";
import { ERC20 } from "../generated/Factory/ERC20";
import { ERC20SymbolBytes } from "../generated/Factory/ERC20SymbolBytes";
import { ERC20NameBytes } from "../generated/Factory/ERC20NameBytes";
import { RewarderViaMultiplier } from "../generated/MasterChef/RewarderViaMultiplier";
import {
  User,
  Bundle,
  Farm,
  Token,
  FarmingPosition,
  Pair,
  FarmReward,
  Masterchef,
  FarmRewarder,
} from "../generated/schema";

export const ADDRESS_ZERO = '0x0000000000000000000000000000000000000000'
export const FACTORY_ADDRESS = '0xEd69D8ae94576Ed6455EDE5bfAF319728CFCA407'
export const ROUTER_ADDRESS = '0x672b4326acda2d186f117a102e779e54d5a536ce'
export const QUACK_ADDRESS = "0xc0e303034b59132e4f5230ac53f076c4d682431e";

export let ZERO_BI = BigInt.fromI32(0);
export let ONE_BI = BigInt.fromI32(1);
export let ZERO_BD = BigDecimal.fromString("0");
export let ONE_BD = BigDecimal.fromString("1");
export let TWO_BD = BigDecimal.fromString("2");
export let TEN_BD = BigDecimal.fromString("10");
export let BI_18 = BigInt.fromI32(18);

export function exponentToBigDecimal(decimals: BigInt): BigDecimal {
  let bd = ONE_BD;
  for (let i = ZERO_BI; i.lt(decimals as BigInt); i = i.plus(ONE_BI)) {
    bd = bd.times(TEN_BD);
  }
  return bd;
}

export function convertTokenToDecimal(
  tokenAmount: BigInt,
  exchangeDecimals: BigInt
): BigDecimal {
  if (exchangeDecimals == ZERO_BI) {
    return tokenAmount.toBigDecimal();
  }
  return tokenAmount.toBigDecimal().div(exponentToBigDecimal(exchangeDecimals));
}

export function isNullEthValue(value: string): boolean {
  return (
    value ==
    "0x0000000000000000000000000000000000000000000000000000000000000001"
  );
}

export function fetchTokenSymbol(tokenAddress: Address): string {
  // hard coded overrides
  // ...

  let contract = ERC20.bind(tokenAddress);
  let contractSymbolBytes = ERC20SymbolBytes.bind(tokenAddress);

  // try types string and bytes32 for symbol
  let symbolValue = "unknown";
  let symbolResult = contract.try_symbol();
  if (symbolResult.reverted) {
    let symbolResultBytes = contractSymbolBytes.try_symbol();
    if (!symbolResultBytes.reverted) {
      // for broken pairs that have no symbol function exposed
      if (!isNullEthValue(symbolResultBytes.value.toHexString())) {
        symbolValue = symbolResultBytes.value.toString();
      }
    }
  } else {
    symbolValue = symbolResult.value;
  }

  return symbolValue;
}

export function fetchTokenName(tokenAddress: Address): string {
  // hard coded overrides
  // ...

  let contract = ERC20.bind(tokenAddress);
  let contractNameBytes = ERC20NameBytes.bind(tokenAddress);

  // try types string and bytes32 for name
  let nameValue = "unknown";
  let nameResult = contract.try_name();
  if (nameResult.reverted) {
    let nameResultBytes = contractNameBytes.try_name();
    if (!nameResultBytes.reverted) {
      // for broken exchanges that have no name function exposed
      if (!isNullEthValue(nameResultBytes.value.toHexString())) {
        nameValue = nameResultBytes.value.toString();
      }
    }
  } else {
    nameValue = nameResult.value;
  }

  return nameValue;
}

export function fetchTokenTotalSupply(tokenAddress: Address): BigInt {
  let contract = ERC20.bind(tokenAddress);
  let totalSupplyValue = null;
  let totalSupplyResult = contract.try_totalSupply();
  if (!totalSupplyResult.reverted) {
    // @ts-ignore
    totalSupplyValue = totalSupplyResult as i32;
  }
  // @ts-ignore
  return BigInt.fromI32(totalSupplyValue as i32);
}

export function fetchTokenDecimals(tokenAddress: Address): BigInt {
  // hardcode overrides
  // ...

  let contract = ERC20.bind(tokenAddress);
  // try types uint8 for decimals
  let decimalValue = null;
  let decimalResult = contract.try_decimals();
  if (!decimalResult.reverted) {
    decimalValue = decimalResult.value;
  }
  // @ts-ignore
  return BigInt.fromI32(decimalValue as i32);
}

export function fetchRewardTokens(rewarderAddress: Address): Array<Address> {
  let contract = RewarderViaMultiplier.bind(rewarderAddress);
  let totalRewardTokenValue = [] as Array<Address>;
  let totalRewardTokenResult = contract.try_getRewardTokens();

  if (!totalRewardTokenResult.reverted) {
    totalRewardTokenValue = totalRewardTokenResult.value;
  }

  return totalRewardTokenValue;
}

export function fetchRewardMultipliers(
  rewarderAddress: Address
): Array<BigInt> {
  let contract = RewarderViaMultiplier.bind(rewarderAddress);
  let totalRewardMultiplierValue = [] as Array<BigInt>;
  let totalRewardMultiplierResult = contract.try_getRewardMultipliers();
  if (!totalRewardMultiplierResult.reverted) {
    totalRewardMultiplierValue = totalRewardMultiplierResult.value;
  }

  return totalRewardMultiplierValue as Array<BigInt>;
}

export function createStakingPosition(
  exchange: Address,
  user: Address,
  farmKey: string
): FarmingPosition {
  let id = exchange
    .toHexString()
    .concat("-")
    .concat(user.toHexString());
  let lp = FarmingPosition.load(id);
  if (lp === null) {
    let pair = Pair.load(exchange.toHexString());
    pair.liquidityProviderCount = pair.liquidityProviderCount.plus(ONE_BI);
    lp = new FarmingPosition(id);
    lp.stakedTokenBalance = ZERO_BD;
    lp.farm = farmKey;
    lp.pairAddress = exchange;
    lp.pair = exchange.toHexString();
    lp.userAddress = user;
    lp.user = user.toHexString();
    lp.save();
    pair.save();
  }
  return lp as FarmingPosition;
}

export function createUser(address: Address): void {
  let user = User.load(address.toHexString());
  if (user === null) {
    user = new User(address.toHexString());
    user.usdSwapped = ZERO_BD;
    user.save();
  }
}

export function createUpdateRewarder(
  rewarderId: string,
  farmKey: string
): void {
  let farmRewarder = FarmRewarder.load(rewarderId);
  if (farmRewarder === null) {
    farmRewarder = new FarmRewarder(rewarderId);
    farmRewarder.farm = farmKey;
  }

  farmRewarder.save();
}

export function createUpdateMasterChef(
  masterchefKey: string,
  rewardsExpiration: BigInt = ZERO_BI,
  totalAllocPoint: BigInt = ZERO_BI,
  rewardPerSecond: BigInt = ZERO_BI
): void {
  let masterchef = Masterchef.load(masterchefKey);

  if (masterchef !== null) {
    if (rewardsExpiration !== ZERO_BI) {
      masterchef.rewardsExpiration = rewardsExpiration;
    }

    if (totalAllocPoint !== ZERO_BI) {
      masterchef.totalAllocPoint = totalAllocPoint;
    }

    if (rewardPerSecond !== ZERO_BI) {
      masterchef.rewardPerSecond = rewardPerSecond;
    }

    masterchef.save();
  } else {
    let masterchef = new Masterchef(masterchefKey);
    masterchef.rewardsExpiration = rewardsExpiration;
    masterchef.totalAllocPoint = totalAllocPoint;
    masterchef.rewardPerSecond = rewardPerSecond;
    masterchef.save();
  }
}

export function createFarmReward(
  rewardKey: string,
  tokenAddress: string,
  multiplier: BigInt,
  rewarderId: string
): void {
  let token = Token.load(tokenAddress);

  let reward = new FarmReward(rewardKey);
  reward.token = token.id;
  reward.multiplier = multiplier;
  reward.rewarder = rewarderId;
  reward.save();
}

export function createFarm(
  chef: Address,
  pid: BigInt,
  pair: Address,
  rewarderAddress: Address,
  allocPoint: BigInt
): void {
  let masterchefKey = chef.toHexString();

  let masterchef = Masterchef.load(masterchefKey);
  let totalAllocPoint = ZERO_BI;
  if (masterchef !== null) {
    totalAllocPoint = masterchef.totalAllocPoint.plus(allocPoint);
  } else {
    totalAllocPoint = totalAllocPoint.plus(allocPoint);
  }
  createUpdateMasterChef(masterchefKey, ZERO_BI, totalAllocPoint, ZERO_BI);

  let farmKey = chef.toHexString() + "-" + pid.toHexString();
  let rewarderId = rewarderAddress.toHexString() + "-" + pid.toHexString();
  let farm = Farm.load(farmKey);
  if (farm === null) {
    farm = new Farm(farmKey);
    farm.chefAddress = chef;
    farm.pid = pid;
    farm.pairAddress = pair;
    farm.rewarderAddress = rewarderAddress;
    farm.tvl = ZERO_BD;
    farm.allocPoint = allocPoint;
    farm.rewarder = rewarderId;
    farm.masterchef = masterchefKey;

    let pairData = Pair.load(pair.toHexString());

    if (!!pairData) {
      farm.pair = pairData.id;
    }

    farm.save();

    createUpdateRewarder(rewarderId, farmKey);

    createUpdateFarmRewards(rewarderAddress, pid);
  }
}

export function createUpdateFarmRewards(
  rewarderAddress: Address,
  pid: BigInt
): void {
  let rewarderId = rewarderAddress.toHexString() + "-" + pid.toHexString();
  let farmRewarder = FarmRewarder.load(rewarderId);

  if (farmRewarder === null) return;

  // create default reward only if we creating farm rewards
  let defaultRewardKey =
    rewarderAddress.toHexString() + "-" + QUACK_ADDRESS + "-" + pid.toString();

  createFarmReward(defaultRewardKey, QUACK_ADDRESS, ONE_BI, rewarderId);

  if (rewarderAddress.toHexString() != ADDRESS_ZERO) {
    let rewardTokens = fetchRewardTokens(rewarderAddress);
    let multipliers = fetchRewardMultipliers(rewarderAddress);

    if (Array.isArray(rewardTokens)) {
      for (let i = 0; i < rewardTokens.length; ++i) {
        let rewarderAddrKey = rewarderAddress.toHexString();
        let rewardTokensKey = rewardTokens[i].toHexString();

        let rewardKey =
          rewarderAddrKey +
          "-" +
          rewardTokensKey +
          "-" +
          BigInt.fromI32(i).toString();

        let multiplier = multipliers[i];
        createFarmReward(rewardKey, rewardTokensKey, multiplier, rewarderId);
      }
    }
  }
}
