//! Serves the public wait snapshot from the container's private Worker binding.
mod park_waits;

use axum::{
    Json, Router,
    extract::Request,
    middleware::{self, Next},
    routing::get,
};
use serde::Serialize;
use std::{net::Ipv4Addr, time::Duration};
use tokio::{
    net::TcpListener,
    sync::watch,
    time::{Instant, timeout_at},
};

const RELEASE_REVISION: &str = include_str!("../release-revision.txt");
const IDLE_TIMEOUT: Duration = Duration::from_secs(90);

#[derive(Serialize)]
struct Health {
    status: &'static str,
}

async fn wait_for_idle(mut activity: watch::Receiver<Instant>) {
    loop {
        let deadline = *activity.borrow_and_update() + IDLE_TIMEOUT;
        if !matches!(timeout_at(deadline, activity.changed()).await, Ok(Ok(()))) {
            return;
        }
    }
}

/// Starts the container HTTP server and returns startup or serving errors.
#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let client = reqwest::Client::builder()
        .no_proxy()
        .redirect(reqwest::redirect::Policy::none())
        .timeout(Duration::from_secs(3))
        .build()?;
    let (activity, idle) = watch::channel(Instant::now());
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
        .route_layer(middleware::from_fn(move |request: Request, next: Next| {
            let activity = activity.clone();
            async move {
                activity.send_replace(Instant::now());
                let response = next.run(request).await;
                activity.send_replace(Instant::now());
                response
            }
        }))
        .with_state(client);

    let listener = TcpListener::bind((Ipv4Addr::UNSPECIFIED, 8080)).await?;
    // The process must be able to stop even if the container proxy retains an unread response.
    axum::serve(listener, router)
        .with_graceful_shutdown(wait_for_idle(idle))
        .await?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::{IDLE_TIMEOUT, wait_for_idle};
    use std::time::Duration;
    use tokio::{
        sync::watch,
        task::yield_now,
        time::{Instant, advance},
    };

    #[tokio::test(start_paused = true)]
    async fn advances_the_shutdown_deadline_when_a_request_arrives() {
        let (activity, idle) = watch::channel(Instant::now());
        let shutdown = tokio::spawn(wait_for_idle(idle));
        yield_now().await;

        let remaining = Duration::from_secs(1);
        advance(IDLE_TIMEOUT - remaining).await;
        assert!(!shutdown.is_finished());
        activity.send_replace(Instant::now());
        yield_now().await;

        advance(IDLE_TIMEOUT - remaining).await;
        assert!(!shutdown.is_finished());
        advance(remaining).await;
        yield_now().await;
        assert!(shutdown.is_finished());
        shutdown.await.expect("idle task should end normally");
    }
}
