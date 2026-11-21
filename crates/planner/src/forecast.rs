//! Forecasts one attraction from comparable local times on distinct days.

use std::collections::BTreeMap;

const MINUTES_PER_DAY: u16 = 1_440;
const MATCH_WINDOW_MINUTES: u16 = 60;
const MIN_SAMPLE_DAYS: usize = 3;
const LOOKBACK_DAYS: u32 = 30;
const MAX_WAIT_MINUTES: u16 = 300;

/// An attraction's observed wait at a park-local time.
#[derive(Clone, Copy, Debug)]
pub struct Observation {
    /// An ordinal calendar day, using the same origin as the target.
    pub day: i32,
    /// Minutes since local midnight, in the range 0 through 1439.
    pub minute: u16,
    /// Whether this observation is from a weekend.
    pub weekend: bool,
    /// The observed standby wait in minutes. Supply only operating rides.
    pub wait_minutes: u16,
}

/// A historical estimate and the number of distinct contributing dates.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct Forecast {
    /// Estimated standby wait in minutes.
    pub wait_minutes: u16,
    /// Number of historical days used in the estimate.
    pub sample_days: usize,
}

/// Estimates a wait from the last 30 comparable dates near the target time.
/// Returns no estimate when fewer than three distinct dates qualify.
pub fn forecast_wait(
    observations: &[Observation],
    target_day: i32,
    target_minute: u16,
    weekend: bool,
) -> Option<Forecast> {
    if target_minute >= MINUTES_PER_DAY {
        return None;
    }

    let mut by_day = BTreeMap::<i32, Vec<u16>>::new();
    for observation in observations {
        if observation.day < target_day
            && target_day.abs_diff(observation.day) <= LOOKBACK_DAYS
            && observation.weekend == weekend
            && observation.minute < MINUTES_PER_DAY
            && observation.minute.abs_diff(target_minute) <= MATCH_WINDOW_MINUTES
            && observation.wait_minutes <= MAX_WAIT_MINUTES
        {
            by_day
                .entry(observation.day)
                .or_default()
                .push(observation.wait_minutes);
        }
    }
    if by_day.len() < MIN_SAMPLE_DAYS {
        return None;
    }
    let mut typical_waits: Vec<_> = by_day.values_mut().map(|waits| median(waits)).collect();
    Some(Forecast {
        wait_minutes: median(&mut typical_waits),
        sample_days: typical_waits.len(),
    })
}

fn median(waits: &mut [u16]) -> u16 {
    waits.sort_unstable();
    // Each wait was limited to 300 minutes before calculating the median.
    let upper = waits[waits.len() / 2];
    let lower = waits[(waits.len() - 1) / 2];
    (upper + lower).div_ceil(2)
}

#[cfg(test)]
mod tests {
    use super::{Forecast, Observation, forecast_wait};

    #[test]
    fn weighs_each_comparable_date_equally() {
        let latest = Observation {
            day: 19,
            minute: 540,
            weekend: false,
            wait_minutes: 20,
        };
        let mut rows = vec![latest; 50];
        rows.extend([
            Observation {
                day: 18,
                wait_minutes: 40,
                ..latest
            },
            Observation {
                day: 17,
                wait_minutes: 55,
                ..latest
            },
            Observation {
                day: 16,
                weekend: true,
                wait_minutes: 120,
                ..latest
            },
            Observation {
                day: 16,
                minute: 620,
                wait_minutes: 120,
                ..latest
            },
            Observation {
                day: 20,
                wait_minutes: 120,
                ..latest
            },
        ]);
        assert_eq!(
            forecast_wait(&rows, 20, 540, false),
            Some(Forecast {
                wait_minutes: 40,
                sample_days: 3
            }),
        );
        assert_eq!(forecast_wait(&rows[..50], 20, 540, false), None);
    }
}
