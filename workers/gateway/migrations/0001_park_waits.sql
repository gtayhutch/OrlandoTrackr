CREATE TABLE parks (
  id text PRIMARY KEY,
  name text NOT NULL,
  locality text NOT NULL,
  display_order integer NOT NULL CHECK (display_order >= 0)
);

CREATE TABLE ride_waits (
  id text PRIMARY KEY,
  park_id text NOT NULL REFERENCES parks (id),
  name text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('Thrill', 'Family', 'Show')),
  minutes integer CHECK (minutes BETWEEN 0 AND 300)
);

CREATE INDEX ride_waits_by_park ON ride_waits (park_id);
