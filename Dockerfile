FROM rust:1.97.1-bookworm@sha256:0e2bcaef56d041a486784e54104a81aebe0da44bd03019bd70bc0401e42e4a97 AS builder
WORKDIR /source
COPY Cargo.toml Cargo.lock rust-toolchain.toml ./
COPY crates/planner ./crates/planner
COPY services/api ./services/api
RUN cargo build --release --locked --package orlandotrackr-api

FROM debian:bookworm-slim@sha256:734a72b3d6142a71993b4bc580ca01d8ca687f77a2c422d96a961d3376b179bc
COPY --from=builder /source/target/release/orlandotrackr-api /usr/local/bin/orlandotrackr-api
USER 65534:65534
EXPOSE 8080
ENTRYPOINT ["/usr/local/bin/orlandotrackr-api"]
