import { BadRequestException } from '@nestjs/common';

const PINCODE_FORMAT = /^[1-9][0-9]{5}$/;

export interface PincodeLookupResult {
  pinCode: string;
  city: string;
  state: string;
}

/**
 * Looks up City/State for an India PIN code via the public India Post API.
 * Used to auto-derive Retailer.city/state from Retailer.pinCode so a
 * retailer's address data stays internally consistent without asking the
 * user to type city/state by hand.
 */
export async function lookupPincode(pinCode: string): Promise<PincodeLookupResult> {
  const normalized = pinCode.trim();
  if (!PINCODE_FORMAT.test(normalized)) {
    throw new BadRequestException(`Invalid PIN code format: ${pinCode}`);
  }

  let response: Response;
  try {
    response = await fetch(`https://api.postalpincode.in/pincode/${normalized}`);
  } catch (err) {
    throw new BadRequestException('Could not reach PIN code lookup service — try again');
  }

  if (!response.ok) {
    throw new BadRequestException('PIN code lookup service returned an error');
  }

  const data = (await response.json()) as Array<{
    Status: string;
    PostOffice?: Array<{ District: string; State: string }>;
  }>;

  const result = data?.[0];
  if (!result || result.Status !== 'Success' || !result.PostOffice?.length) {
    throw new BadRequestException(`PIN code ${normalized} not found`);
  }

  const postOffice = result.PostOffice[0];
  return { pinCode: normalized, city: postOffice.District, state: postOffice.State };
}
