//! Money helpers shared by articles, sales and returns. All amounts are in
//! Rappen (cents). Mirrored in `src/lib/money/discount.ts` for the checkout
//! preview - keep both in sync.

/// Rounds to the nearest 5 Rappen, the smallest Swiss cash unit.
pub fn round_to_5_rappen(cents: f64) -> i64 {
    ((cents / 5.0).round() * 5.0) as i64
}

/// Price after a percentage discount, rounded to 5 Rappen.
pub fn apply_percent_discount(price_cents: i64, percent: f64) -> i64 {
    if percent <= 0.0 {
        return price_cents;
    }
    round_to_5_rappen(price_cents as f64 * (100.0 - percent) / 100.0)
}

/// Splits `amount` across `weights` proportionally so the parts sum to
/// exactly `amount` (largest-remainder method). Used to spread a sale
/// discount over its lines.
pub fn allocate_proportionally(amount: i64, weights: &[i64]) -> Vec<i64> {
    let total: i64 = weights.iter().sum();
    if total <= 0 || amount == 0 {
        return vec![0; weights.len()];
    }
    let mut parts: Vec<i64> = weights.iter().map(|w| amount * w / total).collect();
    let mut remainders: Vec<(usize, i64)> = weights
        .iter()
        .enumerate()
        .map(|(i, w)| (i, (amount * w) % total))
        .collect();
    remainders.sort_by(|a, b| b.1.cmp(&a.1));
    let missing = amount - parts.iter().sum::<i64>();
    for (i, _) in remainders.into_iter().take(missing as usize) {
        parts[i] += 1;
    }
    parts
}

/// Share of `total` for `numerator / denominator`, rounded so that summing
/// consecutive shares (0→a, a→b, …) never drifts: returning a line in several
/// partial returns refunds exactly what was paid for it.
pub fn cumulative_share(total: i64, numerator: i64, denominator: i64) -> i64 {
    if denominator <= 0 {
        return 0;
    }
    (total as f64 * numerator as f64 / denominator as f64).round() as i64
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rounds_to_5_rappen() {
        assert_eq!(round_to_5_rappen(1232.0), 1230);
        assert_eq!(round_to_5_rappen(1233.0), 1235);
        assert_eq!(apply_percent_discount(2500, 20.0), 2000);
        assert_eq!(apply_percent_discount(1990, 15.0), 1690);
        assert_eq!(apply_percent_discount(1990, 0.0), 1990);
    }

    #[test]
    fn allocation_sums_exactly() {
        let parts = allocate_proportionally(1000, &[3000, 3000, 3000]);
        assert_eq!(parts.iter().sum::<i64>(), 1000);
        assert_eq!(parts, vec![334, 333, 333]);
        assert_eq!(allocate_proportionally(0, &[100, 200]), vec![0, 0]);
    }

    #[test]
    fn partial_returns_refund_exactly_the_line() {
        // 3 units, net line 1000: returning 1 + 1 + 1 must refund 1000 total.
        let refunds: Vec<i64> = (0..3)
            .map(|k| cumulative_share(1000, k + 1, 3) - cumulative_share(1000, k, 3))
            .collect();
        assert_eq!(refunds.iter().sum::<i64>(), 1000);
    }
}
