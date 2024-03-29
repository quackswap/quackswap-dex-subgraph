/* eslint-disable prefer-const */
import { Address } from "@graphprotocol/graph-ts";
import { Farm, Masterchef } from "../generated/schema";
import {
  convertTokenToDecimal,
  createUser,
  BI_18,
  createStakingPosition,
  createFarm,
  createUpdateFarmRewards,
  ZERO_BI,
  createUpdateRewarder,
  createUpdateMasterChef,
} from "./helpers";
import {
  Deposit,
  PoolAdded,
  Withdraw,
  EmergencyWithdraw,
  PoolSet,
  LogRewardPerSecond
} from "../generated/MasterChef/MasterChef";

export function handlePoolAdded(event: PoolAdded): void {
  createFarm(
    event.address,
    event.params.pid,
    event.params.lpToken,
    event.params.rewarder,
    event.params.allocPoint
  );
}

export function handleDeposit(event: Deposit): void {
  let farmKey =
    event.address.toHexString() + "-" + event.params.pid.toHexString();

  let farm = Farm.load(farmKey);

  let convertedAmount = convertTokenToDecimal(event.params.amount, BI_18);

  farm.tvl = farm.tvl.plus(convertedAmount);

  farm.save();

  // user stats
  createUser(event.params.to);

  let toUserStakingPosition = createStakingPosition(
    farm.pairAddress as Address,
    event.params.to,
    farmKey
  );
  toUserStakingPosition.stakedTokenBalance = toUserStakingPosition.stakedTokenBalance.plus(
    convertedAmount
  );
  toUserStakingPosition.save();
}

export function handleWithdraw(event: Withdraw): void {
  let farmKey =
    event.address.toHexString() + "-" + event.params.pid.toHexString();

  let farm = Farm.load(farmKey);

  let convertedAmount = convertTokenToDecimal(event.params.amount, BI_18);

  farm.tvl = farm.tvl.minus(convertedAmount);

  farm.save();

  // user stats
  createUser(event.params.to);

  let fromUserStakingPosition = createStakingPosition(
    farm.pairAddress as Address,
    event.params.user,
    farmKey
  );
  fromUserStakingPosition.stakedTokenBalance = fromUserStakingPosition.stakedTokenBalance.minus(
    convertedAmount
  );
  fromUserStakingPosition.save();
}

export function handleEmergencyWithdraw(event: EmergencyWithdraw): void {
  let farmKey =
    event.address.toHexString() + "-" + event.params.pid.toHexString();
  let farm = Farm.load(farmKey);

  let convertedAmount = convertTokenToDecimal(event.params.amount, BI_18);
  farm.tvl = farm.tvl.minus(convertedAmount);

  // user stats
  createUser(event.params.to);

  let fromUserStakingPosition = createStakingPosition(
    farm.pairAddress as Address,
    event.params.user,
    farmKey
  );
  fromUserStakingPosition.stakedTokenBalance = fromUserStakingPosition.stakedTokenBalance.minus(
    convertedAmount
  );
  fromUserStakingPosition.save();
  farm.save();
}

export function handlePoolSet(event: PoolSet): void {
  let allocPoint = event.params.allocPoint;
  let overwrite = event.params.overwrite;
  let pid = event.params.pid;
  let rewarder = event.params.rewarder;
  let masterchefKey = event.address.toHexString();
  let farmKey = masterchefKey + "-" + pid.toHexString();
  let rewarderId = rewarder.toHexString() + "-" + pid.toHexString();

  let farm = Farm.load(farmKey);

  if (farm !== null) {
    // if we want to overwrite then update rewarder in farm
    if (overwrite) {
      createUpdateRewarder(rewarderId, farmKey);
      farm.rewarder = rewarderId;
    }

    let masterchef = Masterchef.load(masterchefKey);
    let totalAllocPoint = ZERO_BI;

    if (masterchef !== null) {
      totalAllocPoint = masterchef.totalAllocPoint.plus(
        allocPoint.minus(farm.allocPoint)
      );
    }

    farm.allocPoint = allocPoint;
    createUpdateMasterChef(masterchefKey, ZERO_BI, totalAllocPoint, ZERO_BI);
    farm.save();
  }

  createUpdateFarmRewards(rewarder, pid);
}

export function handleLogRewardPerSecond(event: LogRewardPerSecond): void {
  createUpdateMasterChef(
    event.address.toHexString(),
    ZERO_BI,
    ZERO_BI,
    event.params.rewardPerSecond
  );
}
