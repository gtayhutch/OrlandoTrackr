//! Serves the public wait snapshot from the container's private Worker binding.
mod park_waits;

use axum::{Json, Router, routing::get};
use serde::Serialize;
use std::{net::Ipv4Addr, time::Duration};
use tokio::net::TcpListener;

const RELEASE_REVISION: &str = include_str!("../release-revision.txt");

#[derive(Serialize)]
struct Health {
    status: &'static str,
}

/// Starts the container HTTP server and returns startup or serving errors.
#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let client = reqwest::Client::builder()
        .no_proxy()
        .redirect(reqwest::redirect::Policy::none())
        .timeout(Duration::from_secs(3))
        .build()?;
    let router = Router::new()
        .route(
            "/health",
            get(|| async {
                (
                    [
                        ("Cache-Control", "no-store"),
                        ("X-Release-Revision", RELEASE_REVISION.trim()),
                    ],
                    Json(Health { status: "ok" }),
                )
            }),
        )
        .route("/api/v1/park-waits", get(park_waits::get_public_waits))
        .with_state(client);

    let listener = TcpListener::bind((Ipv4Addr::UNSPECIFIED, 8080)).await?;
    axum::serve(listener, router).await?;
    Ok(())
}
