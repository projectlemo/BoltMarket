Margin is the most misunderstood number on a trading platform. It is not a fee and it is not your risk. It is a deposit the platform sets aside while your positions are open, and watching it tells you how much room you have before the platform starts closing trades for you.

## The numbers in the Trade tab

MetaTrader 5 shows a row of figures at the bottom of the Trade tab:

- **Balance:** your account value from closed trades only.
- **Equity:** balance plus or minus the floating profit and loss of open positions.
- **Margin:** the amount currently set aside for open positions (used margin).
- **Free margin:** equity minus margin. This is what is available to open new positions or absorb losses.
- **Margin level:** equity divided by margin, as a percentage.

## How used margin is calculated

For a currency pair, used margin is roughly the position's value divided by your leverage. One lot of EUR/USD at 1.1600 is about $116,000 of exposure; at 1:100 leverage that sets aside about $1,160. The [margin calculator](/tools/margin-calculator) works this out for every instrument. Instrument-specific margin rates on the server can make the requirement higher than the simple formula.

## Margin call and stop-out

Your account has two thresholds, expressed as margin levels:

1. **Margin call.** A warning level. Below it you usually cannot open new positions and you are alerted that your account is under pressure.
2. **Stop-out.** A lower level at which the platform automatically closes positions, starting with the one with the biggest loss, until the margin level recovers.

The exact levels are part of your account's trading conditions and are visible in MetaTrader 5.

## A worked example

You deposit $1,000 and open one lot of EUR/USD with 1:100 leverage. Used margin is about $1,160. That is already more than your equity, so the trade cannot even be opened.

Try 0.2 lots instead. Used margin is about $232.

- At the start, equity is $1,000 and margin level is 1,000 ÷ 232 ≈ 431%.
- EUR/USD falls 300 pips. At $2 per pip, the floating loss is $600 and equity is $400. Margin level is 400 ÷ 232 ≈ 172%.
- It falls another 120 pips. Equity is now $160 and margin level about 69%.

If your stop-out level were 50%, the position would be closed automatically at roughly $116 of equity, after a loss of almost 90% of the deposit.

The lesson is not about the specific percentages. It is that **position size, not leverage, decides how fast equity falls**, and that a planned stop-loss should always close a trade long before the platform has to.

## How to stay well clear

- Size every trade from your stop-loss using the [lot size calculator](/tools/lot-size-calculator).
- Keep free margin comfortably above what any single move could cost.
- Be careful with several positions that move together; their losses add up against one margin pool.
- Reduce size before high-impact events, when gaps can jump past stops.

## Can I lose more than my deposit?

Fast gaps can push equity below zero before positions can be closed. How a negative balance is treated is set out in the client agreement; read it before you trade.
