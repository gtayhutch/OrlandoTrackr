//! Plans a fixed visit window using caller-provided wait and walking estimates.

use std::collections::HashSet;

const MINUTES_PER_DAY: u16 = 1_440;
const MAX_ATTRACTIONS: usize = 50;

/// An attraction considered for one park itinerary.
#[derive(Clone, Copy, Debug)]
pub struct Attraction<'a> {
    /// The unique attraction ID from the public catalog.
    pub id: &'a str,
    /// Whether the visitor marked this attraction as a must-do.
    pub must_do: bool,
    /// Estimated queue time in minutes, if the attraction is available.
    pub wait_minutes: Option<u16>,
    /// Attraction duration in minutes.
    pub duration_minutes: u16,
    /// Walking allowance before joining the queue, in minutes.
    pub walking_minutes: u16,
}

/// One scheduled stop and its estimated bounds in park-local minutes.
#[derive(Debug, Eq, PartialEq)]
pub struct Stop<'a> {
    /// Scheduled attraction ID.
    pub attraction_id: &'a str,
    /// Estimated minute when the visitor joins the queue.
    pub queue_at: u16,
    /// Estimated minute when the visitor completes the attraction.
    pub finish_at: u16,
}

/// A plan and the IDs of requested priorities it could not fit.
#[derive(Debug, Eq, PartialEq)]
pub struct Itinerary<'a> {
    /// Scheduled stops in visiting order.
    pub stops: Vec<Stop<'a>>,
    /// Must-do attractions omitted because of missing estimates or time.
    pub omitted_priorities: Vec<&'a str>,
}

/// The itinerary request did not meet the planner's input constraints.
#[derive(Debug, Eq, PartialEq)]
pub enum PlanError {
    /// Times must define a visit window within a single calendar day.
    InvalidVisitWindow,
    /// Attractions must be bounded and have unique IDs and valid durations.
    InvalidAttractions,
}

/// Fills a visit window with must-do rides first, then optional rides.
/// Within each group, shorter estimated stops come first to fit more rides.
pub fn plan_visit<'a>(
    attractions: &[Attraction<'a>],
    start_minute: u16,
    end_minute: u16,
) -> Result<Itinerary<'a>, PlanError> {
    if start_minute >= end_minute || end_minute > MINUTES_PER_DAY {
        return Err(PlanError::InvalidVisitWindow);
    }
    validate_attractions(attractions)?;
    let mut ordered = attractions.to_vec();
    ordered.sort_unstable_by_key(|attraction| {
        (
            !attraction.must_do,
            total_minutes(attraction),
            attraction.id,
        )
    });

    let mut result = Itinerary {
        stops: Vec::new(),
        omitted_priorities: Vec::new(),
    };
    let mut now = start_minute;
    for attraction in ordered {
        if let Some(cost) = total_minutes(&attraction).filter(|cost| *cost <= end_minute - now) {
            let finish_at = now + cost;
            result.stops.push(Stop {
                attraction_id: attraction.id,
                queue_at: now + attraction.walking_minutes,
                finish_at,
            });
            now = finish_at;
        } else if attraction.must_do {
            result.omitted_priorities.push(attraction.id);
        }
    }
    Ok(result)
}

fn validate_attractions(attractions: &[Attraction<'_>]) -> Result<(), PlanError> {
    let mut ids = HashSet::new();
    if attractions.len() > MAX_ATTRACTIONS
        || attractions.iter().any(|attraction| {
            attraction.id.is_empty()
                || attraction.duration_minutes == 0
                || attraction.duration_minutes > MINUTES_PER_DAY
                || attraction.walking_minutes > MINUTES_PER_DAY
                || attraction.wait_minutes.is_some_and(|wait| wait > 300)
                || !ids.insert(attraction.id)
        })
    {
        return Err(PlanError::InvalidAttractions);
    }
    Ok(())
}

fn total_minutes(attraction: &Attraction<'_>) -> Option<u16> {
    attraction
        .wait_minutes
        .map(|wait| wait + attraction.duration_minutes + attraction.walking_minutes)
}

#[cfg(test)]
mod tests {
    use super::{Attraction, PlanError, Stop, plan_visit};

    #[test]
    fn schedules_priorities_before_optional_rides_and_reports_unavailable_priorities() {
        let favorite = Attraction {
            id: "favorite",
            must_do: true,
            wait_minutes: Some(20),
            duration_minutes: 5,
            walking_minutes: 4,
        };
        let optional = Attraction {
            id: "optional",
            must_do: false,
            wait_minutes: Some(5),
            ..favorite
        };
        let unavailable = Attraction {
            id: "closed",
            wait_minutes: None,
            ..favorite
        };
        let itinerary =
            plan_visit(&[optional, unavailable, favorite], 540, 580).expect("valid visit");
        assert_eq!(
            itinerary.stops,
            [Stop {
                attraction_id: "favorite",
                queue_at: 544,
                finish_at: 569
            }]
        );
        assert_eq!(itinerary.omitted_priorities, ["closed"]);
        assert_eq!(
            plan_visit(&[favorite, favorite], 540, 580),
            Err(PlanError::InvalidAttractions)
        );
    }
}
