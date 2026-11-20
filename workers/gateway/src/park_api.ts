import { Container } from '@cloudflare/containers';
import { readPublicParkWaits } from './park_data';

/** Starts the native Axum service with access to the private public-data view. */
export class ParkApi extends Container {
  override defaultPort = 8080;
  override sleepAfter = '90s';
  override enableInternet = false;
}

ParkApi.outboundByHost = {
  'park-data.internal': (request, env) =>
    readPublicParkWaits(request, env.PARK_DATA, env.WAIT_DATA_SOURCE),
};
