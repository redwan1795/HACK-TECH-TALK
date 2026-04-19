import sgMail from '@sendgrid/mail';
import { env } from '../config/env';

sgMail.setApiKey(env.sendgridApiKey);

export interface NotifyFutureOrderParams {
  futureOrderId:   string;
  productKeyword:  string;
  quantityNeeded:  number;
  unit:            string;
  listingId:       string;
  listingTitle:    string;
  listingZip:      string;
  consumerEmail:   string;
  consumerName:    string;
}

export async function sendFutureOrderMatch(params: NotifyFutureOrderParams): Promise<void> {
  const listingUrl = `${env.webBaseUrl}/listings/${params.listingId}`;
  try {
    await sgMail.send({
      to:      params.consumerEmail,
      from:    'noreply@communitygarden.local',
      subject: `A match for your "${params.productKeyword}" request is available!`,
      html: `
        <p>Hi ${params.consumerName},</p>
        <p>Good news! A producer just listed <strong>${params.listingTitle}</strong>
           near ZIP ${params.listingZip} that matches your demand for
           ${params.quantityNeeded} ${params.unit} of ${params.productKeyword}.</p>
        <p><a href="${listingUrl}">View the listing →</a></p>
        <p style="color:#999;font-size:12px;">Community Garden Marketplace</p>
      `,
    });
  } catch (err) {
    // fire-and-forget — log but never propagate
    console.error('[notificationService] SendGrid error:', err);
  }
}
