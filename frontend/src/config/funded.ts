/**
 * Bolt Funded – evaluation programme parameters.
 *
 * ⚠ DEFAULTS SET BY THE DEVELOPER – CONFIRM BEFORE LAUNCH.
 * Plan sizes, fees, targets, limits and the profit split were not part of the brief.
 * They follow a common two-step evaluation structure and must be reviewed by the
 * business owner (and your lawyer, together with the programme terms).
 */
export interface FundedPlan {
  size: number;
  fee: number;
  popular?: boolean;
}

export const fundedPlans: FundedPlan[] = [
  { size: 10_000, fee: 99 },
  { size: 25_000, fee: 199 },
  { size: 50_000, fee: 299, popular: true },
  { size: 100_000, fee: 499 },
  { size: 200_000, fee: 949 },
];

export const fundedRules = {
  phase1Target: 8,
  phase2Target: 5,
  maxDailyLoss: 5,
  maxOverallLoss: 10,
  minTradingDays: 4,
  leverage: 100,
  profitSplit: 80,
  profitSplitScaled: 90,
  firstPayoutDays: 14,
  payoutCycleDays: 14,
  feeRefundedWithFirstPayout: true,
  timeLimit: false,
};
