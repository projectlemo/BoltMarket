Three numbers decide what a trade can make or lose: the **pip**, the **lot** and the **leverage**. Get comfortable with them and position sizing, margin and risk all start to make sense.

## Pips: the unit of movement

A pip is the standard step a currency price moves in. For most pairs it is the fourth decimal place (0.0001); for pairs quoted in Japanese yen it is the second (0.01). Platforms often show one more digit, a fraction of a pip sometimes called a *pipette*.

If EUR/USD moves from 1.16000 to 1.16250, it has moved 25 pips.

Gold, indices and crypto are usually measured in **points** instead of pips. The idea is the same: a fixed price step whose value depends on your position size.

## Lots: the size of your position

In forex, one **standard lot** is 100,000 units of the base currency. MetaTrader 5 lets you trade fractions of that:

| Volume | Units of base currency | Value of 1 pip on EUR/USD |
|---|---|---|
| 1.00 lot | 100,000 | about $10 |
| 0.10 lot | 10,000 | about $1 |
| 0.01 lot | 1,000 | about $0.10 |

So the same 25-pip move is worth around $250 on one lot, $25 on 0.1 lot and $2.50 on 0.01 lot. Lot size is the dial that sets your exposure.

When the quote currency is not your account currency, the pip value is converted at the current rate. One pip on a lot of USD/JPY is 1,000 yen, which is worth a little under $7 at typical exchange rates. The [pip calculator](/tools/pip-calculator) handles the conversion for you.

## Leverage: how much you can control

Leverage lets you open a position larger than the cash you put up. The cash set aside is called **margin**. With 1:100 leverage, every $1 of margin controls $100 of position.

Opening one lot of EUR/USD (about $116,000 of exposure at 1.1600):

- at 1:100 needs roughly $1,160 of margin;
- at 1:500 needs roughly $232.

Here is the part beginners miss: **leverage does not change what a pip is worth**. A one-lot position gains or loses about $10 per pip whether you used 1:50 or 1:500. Leverage only changes how much margin is locked up, which in turn changes how many positions you *can* open and how close you are to a margin call.

## Putting the three together

Suppose you have $2,000, trade 0.5 lots of EUR/USD with 1:200 leverage and the price moves 40 pips against you.

- Pip value: 0.5 lots × $10 = $5 per pip.
- Loss: 40 × $5 = $200, or 10% of your account.
- Margin used: about $290, which is unaffected by the loss itself.

A plan that risks 10% on one idea is aggressive. Shrinking the position to 0.1 lots would cut the same move to a $40 loss, 2% of the account.

## Rules of thumb

1. Choose your position size from your stop-loss and risk budget, not from the margin available. Our [lot size calculator](/tools/lot-size-calculator) does exactly this.
2. Treat high leverage as flexibility, not as a target to use fully.
3. Check the [margin calculator](/tools/margin-calculator) before stacking several positions at once.

Next, read how to turn these numbers into a repeatable [risk management](/blog/risk-management-basics) routine.
