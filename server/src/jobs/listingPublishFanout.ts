import { query } from '../db/client';
import { getCoordinatesForZip } from '../services/geocodeService';
import { sendFutureOrderMatch } from '../services/notificationService';

function haversineDistanceMiles(
  lat1: number, lng1: number,
  lat2: number, lng2: number,
): number {
  const R = 3958.8;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function runFanout(listingId: string): Promise<void> {
  try {
    // Fetch the published listing
    const { rows: listingRows } = await query(
      `SELECT id, title, category, location_zip, location_lat, location_lng
       FROM listings WHERE id = $1`,
      [listingId]
    );
    if (listingRows.length === 0) return;

    const listing = listingRows[0] as {
      id: string;
      title: string;
      category: string;
      location_zip: string;
      location_lat: number | null;
      location_lng: number | null;
    };

    // Find open, non-expired future orders matching keyword or category
    const { rows: candidates } = await query(
      `SELECT fo.id, fo.consumer_id, fo.product_keyword, fo.category,
              fo.quantity_needed, fo.unit, fo.zip, fo.proximity_miles,
              u.email, u.name
       FROM future_orders fo
       JOIN users u ON u.id = fo.consumer_id
       WHERE fo.status = 'open'
         AND fo.expires_at > NOW()
         AND (
           to_tsvector('english', fo.product_keyword) @@ plainto_tsquery('english', $1)
           OR fo.category = $2::listing_category
         )`,
      [listing.title, listing.category]
    );

    for (const fo of candidates as Array<{
      id: string;
      consumer_id: string;
      product_keyword: string;
      category: string | null;
      quantity_needed: number;
      unit: string;
      zip: string;
      proximity_miles: number;
      email: string;
      name: string;
    }>) {
      try {
        // Check proximity if listing has coordinates
        if (listing.location_lat != null && listing.location_lng != null) {
          const foCoords = await getCoordinatesForZip(fo.zip);
          if (foCoords) {
            const dist = haversineDistanceMiles(
              foCoords.lat, foCoords.lng,
              listing.location_lat, listing.location_lng,
            );
            if (dist > fo.proximity_miles) continue;
          }
        }

        // Send notification (fire-and-forget inside sendFutureOrderMatch)
        await sendFutureOrderMatch({
          futureOrderId:  fo.id,
          productKeyword: fo.product_keyword,
          quantityNeeded: fo.quantity_needed,
          unit:           fo.unit,
          listingId:      listing.id,
          listingTitle:   listing.title,
          listingZip:     listing.location_zip,
          consumerEmail:  fo.email,
          consumerName:   fo.name,
        });

        // Update status to matched
        await query(
          `UPDATE future_orders
           SET status = 'matched', matched_listing_id = $1
           WHERE id = $2`,
          [listingId, fo.id]
        );
      } catch (innerErr) {
        console.error(`[listingPublishFanout] Error processing future_order ${fo.id}:`, innerErr);
      }
    }
  } catch (err) {
    console.error('[listingPublishFanout] Fanout error:', err);
  }
}

export function triggerListingPublishFanout(listingId: string): void {
  setImmediate(() => {
    runFanout(listingId).catch((err) => {
      console.error('[listingPublishFanout] Unhandled error:', err);
    });
  });
}

// Exported for testing
export { runFanout };
