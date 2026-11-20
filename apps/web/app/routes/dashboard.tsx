import type { ReactNode } from 'react';
import { data, useLoaderData } from 'react-router';
import type { LoaderFunctionArgs, MetaFunction } from 'react-router';
import {
  Activity,
  ArrowDownRight,
  ArrowRight,
  Blocks,
  Castle,
  Clapperboard,
  Clock3,
  Compass,
  MapPin,
  RollerCoaster,
  Waves,
} from 'lucide-react';
import { parseWaitSnapshot } from '~/features/waits/wait_api.server';
import { averageWait, filterRides, parseFilters } from '~/features/waits/waits';
import type { Park, Ride, WaitFilters, WaitSnapshot } from '~/features/waits/waits';
import { waitRequestContext } from '~/request_context';
import styles from './dashboard.module.css';

const parksIcons = new Map([
  ['disney', Castle],
  ['universal', Clapperboard],
  ['seaworld', Waves],
  ['legoland', Blocks],
]);
const minutesFormat = new Intl.NumberFormat('en-US');

interface ParkSummary extends Park {
  average: number | null;
  count: number;
}

type DashboardData =
  | {
      state: 'ready';
      filters: WaitFilters;
      summaries: ParkSummary[];
      rides: Ride[];
      totalRides: number;
    }
  | { state: 'invalid' | 'unavailable' };

/** Supplies the page title and description for the public comparison route. */
export const meta: MetaFunction = () => [
  { title: 'OrlandoTrackr | Orlando theme park wait times' },
  {
    name: 'description',
    content: 'Compare Orlando theme park waits and find a shorter line.',
  },
];

/** Loads and filters the server-rendered snapshot, including without JavaScript. */
export async function loader({
  request,
  context,
}: LoaderFunctionArgs): Promise<ReturnType<typeof data<DashboardData>>> {
  let snapshot: WaitSnapshot;
  try {
    const response = await context.get(waitRequestContext).loadWaits();
    if (!response.ok) throw new Error('Wait API returned an error');
    snapshot = parseWaitSnapshot(await response.json());
  } catch {
    return data({ state: 'unavailable' }, { status: 503 });
  }
  const filters = parseFilters(new URL(request.url).searchParams, snapshot.parks);
  if (!filters) return data({ state: 'invalid' }, { status: 400 });
  const summaries = snapshot.parks.map((park) => {
    const rides = snapshot.rides.filter((ride) => ride.parkId === park.id);
    return { ...park, average: averageWait(rides), count: rides.length };
  });
  return data({
    state: 'ready',
    filters,
    summaries,
    rides: filterRides(snapshot.rides, filters),
    totalRides: snapshot.rides.length,
  });
}

/** Shows the park cards, ride board, and average wait comparison. */
export default function Dashboard(): ReactNode {
  const dashboard = useLoaderData<typeof loader>();
  if (dashboard.state !== 'ready') {
    return (
      <main id="content" className="route-error" tabIndex={-1}>
        <h1>
          {dashboard.state === 'invalid'
            ? 'Check your wait board filters'
            : 'Wait times are unavailable'}
        </h1>
        <p>
          {dashboard.state === 'invalid'
            ? 'Choose a park and sort order from the wait board.'
            : 'The park snapshot is temporarily unavailable.'}
        </p>
        <a href="/">Back to the wait board</a>
      </main>
    );
  }
  const { filters, summaries, rides, totalRides } = dashboard;
  const parkNames = new Map(summaries.map((park) => [park.id, park.name]));
  const shortestPark = summaries
    .filter((park) => park.average !== null)
    .sort((left, right) => (left.average ?? 0) - (right.average ?? 0))[0];
  const highestAverage = Math.max(1, ...summaries.map((park) => park.average ?? 0));

  return (
    <>
      <header className={styles.header}>
        <div className={styles['header-inner']}>
          <a href="/" className={styles.brand} aria-label="OrlandoTrackr home">
            <span className={styles.mark}>
              <Compass size={24} strokeWidth={2.5} />
            </span>
            <span>
              Orlando<span className={styles['brand-accent']}>Trackr</span>
            </span>
          </a>
          <nav aria-label="Main navigation" className={styles.nav}>
            <a href="#parks">
              <MapPin size={17} aria-hidden="true" /> Parks
            </a>
            <a href="#ride-board">
              <Clock3 size={17} aria-hidden="true" /> Ride board
            </a>
          </nav>
          <span className={styles['sample-badge']}>
            <span className={styles.dot} aria-hidden="true" /> Sample data
          </span>
        </div>
      </header>

      <main id="content" className={styles.page} tabIndex={-1}>
        <section className={styles.hero} aria-labelledby="hero-title">
          <img
            className={styles['hero-image']}
            src="/images/coaster-at-dusk.webp"
            alt=""
            width={960}
            height={720}
            fetchPriority="high"
          />
          <div className={styles['hero-content']}>
            <p className={styles.location}>
              <MapPin size={16} aria-hidden="true" /> Orlando, Florida
            </p>
            <h1 id="hero-title">
              Orlando park
              <br />
              <em>wait times.</em>
            </h1>
            <p className={styles.intro}>
              Compare park waits and find a shorter line for your next ride.
            </p>
            <a className={styles.primary} href="#ride-board">
              Explore ride waits <ArrowDownRight size={18} aria-hidden="true" />
            </a>
          </div>
          <div className={styles['hero-stat']}>
            <Activity size={18} aria-hidden="true" />
            <span>
              <strong>{summaries.length} park groups</strong>
              <br />
              {totalRides} sample attractions
            </span>
          </div>
        </section>

        <section id="parks" aria-labelledby="parks-title" className={styles.section}>
          <div className={styles['section-heading']}>
            <div>
              <h2 id="parks-title">Parks at a glance</h2>
              <p>Compare average waits for the attractions in this snapshot.</p>
            </div>
            <a href="/#ride-board" className={styles['text-link']}>
              See all rides <ArrowRight size={16} aria-hidden="true" />
            </a>
          </div>
          <div className={styles.cards}>
            {summaries.map((park) => {
              const Icon = parksIcons.get(park.id) ?? MapPin;
              return (
                <a
                  className={styles.park}
                  key={park.id}
                  data-park={park.id}
                  href={`/?${new URLSearchParams({ park: park.id })}#ride-board`}
                  aria-current={filters.park === park.id ? 'true' : undefined}
                >
                  <div className={styles['park-top']}>
                    <span className={styles['park-icon']}>
                      <Icon size={22} aria-hidden="true" />
                    </span>
                    <ArrowRight size={17} aria-hidden="true" />
                  </div>
                  <h3>{park.name}</h3>
                  <p>
                    {park.locality} · {park.count} attractions
                  </p>
                  <div className={styles['park-metric']}>
                    <span>
                      {park.average === null ? '—' : minutesFormat.format(park.average)}
                      <small>{park.average === null ? '' : ' min'}</small>
                    </span>
                    <span>avg. wait</span>
                  </div>
                </a>
              );
            })}
          </div>
        </section>

        <section
          id="ride-board"
          className={styles['board-layout']}
          aria-labelledby="board-title"
        >
          <div className={styles.panel}>
            <div className={styles['board-heading']}>
              <div>
                <h2 id="board-title">Ride board</h2>
                <p>Browse sample waits by park.</p>
              </div>
              <span>
                {rides.length} {rides.length === 1 ? 'ride' : 'rides'}
              </span>
            </div>
            <form method="get" action="/#ride-board" className={styles.filters}>
              <label>
                Park
                <select name="park" key={filters.park} defaultValue={filters.park}>
                  <option value="all">All parks</option>
                  {summaries.map((park) => (
                    <option value={park.id} key={park.id}>
                      {park.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Sort by
                <select name="sort" key={filters.sort} defaultValue={filters.sort}>
                  <option value="shortest">Shortest wait</option>
                  <option value="longest">Longest wait</option>
                  <option value="name">Ride name</option>
                </select>
              </label>
              <label>
                Availability
                <select
                  name="availability"
                  key={filters.availability}
                  defaultValue={filters.availability}
                >
                  <option value="all">All rides</option>
                  <option value="open">Open rides</option>
                </select>
              </label>
              <button type="submit">Apply</button>
            </form>
            {rides.length === 0 ? (
              <p className={styles.empty}>No rides match these filters.</p>
            ) : (
              <ul className={styles.rides} aria-label="Ride waits">
                {rides.map((ride) => (
                  <li key={ride.id}>
                    <span className={styles['ride-icon']}>
                      <RollerCoaster size={19} aria-hidden="true" />
                    </span>
                    <div className={styles['ride-name']}>
                      <strong>{ride.name}</strong>
                      <span>
                        {parkNames.get(ride.parkId)} · {ride.kind}
                      </span>
                    </div>
                    <span
                      className={styles.wait}
                      data-unavailable={ride.minutes === null || undefined}
                    >
                      {ride.minutes === null ? (
                        'Unavailable'
                      ) : (
                        <>
                          {ride.minutes} <small>min</small>
                        </>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <aside aria-labelledby="comparison-title" className={styles.comparison}>
            <div className={styles['comparison-title']}>
              <Activity size={20} aria-hidden="true" />
              <h2 id="comparison-title">Compare waits</h2>
            </div>
            {shortestPark && (
              <div className={styles['best-park']}>
                <span>Shortest average wait</span>
                <strong>{shortestPark.name}</strong>
                <span>
                  <strong>{shortestPark.average}</strong> min
                </span>
              </div>
            )}
            <ul className={styles.bars}>
              {summaries.map((park) => (
                <li key={park.id}>
                  <div>
                    <span>{park.name}</span>
                    <strong>
                      {park.average === null ? '—' : park.average + ' min'}
                    </strong>
                  </div>
                  <meter
                    min={0}
                    max={highestAverage}
                    value={park.average ?? 0}
                    aria-label={park.name + ' average wait'}
                  />
                </li>
              ))}
            </ul>
          </aside>
        </section>

        <footer className={styles.footer}>
          <span>OrlandoTrackr · Synthetic wait-time snapshot</span>
          <span>
            Coaster photo by{' '}
            <a href="https://commons.wikimedia.org/wiki/File:Wild_One%27s_wooden_structure_silhouetted_at_sunset_at_Six_Flags_America,_July_2001_-_ThrillZing.jpg">
              ThrillZing
            </a>{' '}
            · <a href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</a> ·
            Cropped
          </span>
        </footer>
      </main>
    </>
  );
}
