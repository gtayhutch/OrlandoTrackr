CREATE TABLE live_park_polls (
  park_id text PRIMARY KEY,
  attempted_at integer NOT NULL,
  retry_at integer,
  succeeded_at integer,
  observed_at integer
);

CREATE TABLE live_ride_waits (
  park_id text NOT NULL REFERENCES live_park_polls (park_id),
  id text NOT NULL,
  name text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('Ride', 'Show')),
  minutes integer CHECK (minutes BETWEEN 0 AND 300),
  observed_at integer NOT NULL,
  PRIMARY KEY (park_id, id)
);

CREATE TABLE live_wait_observations (
  park_id text NOT NULL,
  ride_id text NOT NULL,
  observed_at integer NOT NULL,
  minutes integer CHECK (minutes BETWEEN 0 AND 300),
  PRIMARY KEY (park_id, ride_id, observed_at)
);

CREATE INDEX live_wait_observations_by_time ON live_wait_observations (observed_at);
