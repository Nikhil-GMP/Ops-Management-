// Buffer settings. Change values here only. All amounts are in PAISE (100 paise = Rs 1).

// Buffer amount you already have set aside (Rs 2500 = 250000 paise).
export const BUFFER_OPENING_PAISE = 250000;

// Amount added to the buffer every day (Rs 100 = 10000 paise).
export const BUFFER_PER_DAY_PAISE = 10000;

// First day on which the daily amount is added. Today's amount is included.
// Format: YYYY-MM-DD (India date).
export const BUFFER_START_DATE = "2026-11-19";

// true  = the opening buffer (Rs 2500) is also cut from profit.
//         Profit after buffer = Profit - (opening + daily amounts)
// false = only the daily amounts are cut from profit
//         (use this if the opening Rs 2500 was already set aside earlier).
export const BUFFER_OPENING_CUT_FROM_PROFIT = true;
