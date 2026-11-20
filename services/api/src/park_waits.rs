//! Checks the public read contract and maps database failures to API errors.

use axum::{
    Json,
    extract::State,
    http::{HeaderMap, StatusCode, Uri},
    response::{IntoResponse, Response},
};
use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::time::{SystemTime, UNIX_EPOCH};

const PARK_DATA_URL: &str = "http://park-data.internal/park-waits";

#[derive(Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct Park {
    id: String,
    name: String,
    locality: String,
}

#[derive(Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct Ride {
    id: String,
    park_id: String,
    name: String,
    kind: RideKind,
    minutes: Option<u16>,
}

#[derive(Deserialize, Serialize)]
enum RideKind {
    Thrill,
    Family,
    Show,
    Ride,
}

#[derive(Deserialize, Serialize)]
#[serde(rename_all = "kebab-case")]
enum WaitSource {
    ThemeparksWiki,
}

#[derive(Deserialize, Serialize)]
#[serde(rename_all = "lowercase")]
enum Freshness {
    Current,
    Cached,
    Unavailable,
}

#[derive(Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct Snapshot {
    parks: Vec<Park>,
    rides: Vec<Ride>,
    #[serde(skip_serializing_if = "Option::is_none")]
    source: Option<WaitSource>,
    #[serde(skip_serializing_if = "Option::is_none")]
    freshness: Option<Freshness>,
    #[serde(skip_serializing_if = "Option::is_none")]
    updated_at: Option<u64>,
}

#[derive(Serialize)]
struct Success {
    data: Snapshot,
}

#[derive(Serialize)]
struct ErrorBody {
    error: ApiError,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ApiError {
    code: &'static str,
    message: &'static str,
    request_id: String,
}

/// Reads a fixed public snapshot through intercepted container egress.
/// Returns a generic error if the query parameters or snapshot are invalid.
/// This read is public. It has no access to account data.
pub(crate) async fn get_public_waits(
    State(client): State<Client>,
    uri: Uri,
    headers: HeaderMap,
) -> Response {
    let request_id = request_id(&headers);
    if !valid_request(&uri) {
        return error_response(
            StatusCode::BAD_REQUEST,
            "INVALID_INPUT",
            "Unexpected query parameters.",
            request_id,
        );
    }

    match load_snapshot(&client).await {
        Ok(data) => Json(Success { data }).into_response(),
        Err(error) => {
            let failure = if error.is_timeout() {
                "timeout"
            } else {
                "upstream"
            };
            let timestamp = SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .map_or(0, |duration| duration.as_millis());
            eprintln!(
                concat!(
                    "{{\"severity\":\"ERROR\",\"event\":\"waits.snapshot.failed\",",
                    "\"message\":\"Public snapshot unavailable\",\"requestId\":\"{}\",",
                    "\"timestampMs\":{},\"env\":\"test\",\"release\":\"{}\",\"reason\":\"{}\"}}"
                ),
                request_id,
                timestamp,
                env!("CARGO_PKG_VERSION"),
                failure,
            );
            error_response(
                StatusCode::SERVICE_UNAVAILABLE,
                "INTERNAL",
                "Wait times are temporarily unavailable.",
                request_id,
            )
        }
    }
}

fn valid_request(uri: &Uri) -> bool {
    uri.query().is_none()
}

async fn load_snapshot(client: &Client) -> Result<Snapshot, reqwest::Error> {
    client
        .get(PARK_DATA_URL)
        .send()
        .await?
        .error_for_status()?
        .json()
        .await
}

fn request_id(headers: &HeaderMap) -> String {
    headers
        .get("x-request-id")
        .and_then(|value| value.to_str().ok())
        .filter(|value| {
            value.len() == 36
                && value
                    .bytes()
                    .all(|byte| byte.is_ascii_hexdigit() || byte == b'-')
        })
        .unwrap_or("unknown")
        .to_owned()
}

fn error_response(
    status: StatusCode,
    code: &'static str,
    message: &'static str,
    request_id: String,
) -> Response {
    (
        status,
        Json(ErrorBody {
            error: ApiError {
                code,
                message,
                request_id,
            },
        }),
    )
        .into_response()
}

#[cfg(test)]
mod tests {
    use super::valid_request;

    #[test]
    fn the_snapshot_endpoint_rejects_unexpected_parameters() {
        let plain_uri = "/api/v1/park-waits".parse().expect("valid path");
        let invalid_uri = "/api/v1/park-waits?role=admin".parse().expect("valid URI");
        assert!(valid_request(&plain_uri));
        assert!(!valid_request(&invalid_uri));
    }
}
