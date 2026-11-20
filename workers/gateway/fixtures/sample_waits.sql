INSERT OR REPLACE INTO parks (id, name, locality, display_order)
VALUES
  ('disney', 'Walt Disney World', 'Lake Buena Vista', 0),
  ('universal', 'Universal Orlando', 'Orlando', 1),
  ('seaworld', 'SeaWorld Orlando', 'Orlando', 2),
  ('legoland', 'LEGOLAND Florida', 'Winter Haven', 3);

INSERT OR REPLACE INTO ride_waits (id, park_id, name, kind, minutes)
VALUES
  ('space-mountain', 'disney', 'Space Mountain', 'Thrill', 42),
  ('haunted-mansion', 'disney', 'Haunted Mansion', 'Family', 25),
  ('pirates', 'disney', 'Pirates of the Caribbean', 'Family', 18),
  ('jungle-cruise', 'disney', 'Jungle Cruise', 'Family', 45),
  ('velocicoaster', 'universal', 'Jurassic World VelociCoaster', 'Thrill', 38),
  ('hagrids', 'universal', 'Hagrid’s Motorbike Adventure', 'Thrill', 68),
  ('men-in-black', 'universal', 'MEN IN BLACK Alien Attack', 'Family', 16),
  ('et-adventure', 'universal', 'E.T. Adventure', 'Family', 12),
  ('mako', 'seaworld', 'Mako', 'Thrill', 20),
  ('ice-breaker', 'seaworld', 'Ice Breaker', 'Thrill', 15),
  ('penguin-trek', 'seaworld', 'Penguin Trek', 'Family', 28),
  ('kraken', 'seaworld', 'Kraken', 'Thrill', NULL),
  ('dragon', 'legoland', 'The Dragon', 'Family', 12),
  ('lost-kingdom', 'legoland', 'Lost Kingdom Adventure', 'Family', 8),
  ('flying-school', 'legoland', 'Flying School', 'Thrill', 24),
  ('brick-beard', 'legoland', 'Brickbeard’s Watersport Stunt Show', 'Show', NULL);
