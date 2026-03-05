import type { Pool, PoolConnection, RowDataPacket } from "mysql2/promise";
import type { BackendChannel } from "../backends";

type IdentityRow = RowDataPacket & {
  channel: BackendChannel;
  user_id: string;
  canonical_id: string;
};

type ProfileRow = RowDataPacket & {
  canonical_id: string;
  display_name: string | null;
  phone_normalized: string | null;
  address_text: string | null;
  preferred_payment_method: "bank_transfer" | "cod" | null;
  preferred_category: string | null;
  locale: string | null;
  last_intent: string | null;
  channels_json: string;
  last_seen_at: Date;
  created_at: Date;
  updated_at: Date;
};

export type UpsertCustomerProfileInput = {
  channel: BackendChannel;
  userId: string;
  locale?: string;
  name?: string;
  phone?: string;
  address?: string;
  paymentMethod?: "bank_transfer" | "cod";
  preferredCategory?: string;
  lastIntent?: string;
};

export type CustomerProfileView = {
  canonicalId: string;
  identities: Array<{ channel: BackendChannel; userId: string }>;
  profile: {
    name?: string;
    phone?: string;
    address?: string;
    paymentMethod?: "bank_transfer" | "cod";
    preferredCategory?: string;
    locale?: string;
    lastIntent?: string;
    channels: BackendChannel[];
    lastSeenAt: string;
    updatedAt: string;
  };
};

export class CustomerProfileStoreMySql {
  constructor(private readonly pool: Pool) {}

  async ensureSchema(): Promise<void> {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS chat_user_profiles (
        canonical_id VARCHAR(128) NOT NULL PRIMARY KEY,
        display_name VARCHAR(120) NULL,
        phone_normalized VARCHAR(20) NULL,
        address_text VARCHAR(255) NULL,
        preferred_payment_method ENUM('bank_transfer','cod') NULL,
        preferred_category VARCHAR(64) NULL,
        locale VARCHAR(32) NULL,
        last_intent VARCHAR(64) NULL,
        channels_json LONGTEXT NOT NULL,
        last_seen_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_chat_user_profiles_phone (phone_normalized),
        INDEX idx_chat_user_profiles_seen (last_seen_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS chat_user_identities (
        channel VARCHAR(32) NOT NULL,
        user_id VARCHAR(128) NOT NULL,
        canonical_id VARCHAR(128) NOT NULL,
        confidence TINYINT UNSIGNED NOT NULL DEFAULT 100,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (channel, user_id),
        INDEX idx_chat_user_identities_canonical (canonical_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
  }

  async upsertFromInteraction(input: UpsertCustomerProfileInput): Promise<{ canonicalId: string }> {
    const connection = await this.pool.getConnection();
    try {
      await connection.beginTransaction();

      const normalizedPhone = normalizePhone(input.phone);
      const existingIdentity = await this.getIdentity(connection, input.channel, input.userId);

      let canonicalId = existingIdentity?.canonical_id || "";
      if (!canonicalId && normalizedPhone) {
        const matchedByPhone = await this.getProfileByPhone(connection, normalizedPhone);
        if (matchedByPhone?.canonical_id) {
          canonicalId = matchedByPhone.canonical_id;
        }
      }

      if (!canonicalId) {
        canonicalId = buildCanonicalId(input.channel, input.userId);
      }

      await connection.query(
        `INSERT INTO chat_user_identities (channel, user_id, canonical_id, confidence)
         VALUES (?, ?, ?, 100)
         ON DUPLICATE KEY UPDATE canonical_id = VALUES(canonical_id), confidence = 100, updated_at = CURRENT_TIMESTAMP`,
        [input.channel, input.userId, canonicalId],
      );

      const existingProfile = await this.getProfileByCanonicalId(connection, canonicalId);
      const channels = mergeChannels(existingProfile?.channels_json, input.channel);
      const displayName = firstNonEmpty(trimTo(input.name, 120), existingProfile?.display_name || undefined);
      const addressText = firstNonEmpty(trimTo(input.address, 255), existingProfile?.address_text || undefined);
      const paymentMethod = input.paymentMethod || existingProfile?.preferred_payment_method || null;
      const preferredCategory = firstNonEmpty(trimTo(input.preferredCategory, 64), existingProfile?.preferred_category || undefined);
      const locale = firstNonEmpty(trimTo(input.locale, 32), existingProfile?.locale || undefined);
      const lastIntent = firstNonEmpty(trimTo(input.lastIntent, 64), existingProfile?.last_intent || undefined);

      await connection.query(
        `INSERT INTO chat_user_profiles (
           canonical_id, display_name, phone_normalized, address_text, preferred_payment_method,
           preferred_category, locale, last_intent, channels_json, last_seen_at
         )
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, UTC_TIMESTAMP())
         ON DUPLICATE KEY UPDATE
           display_name = VALUES(display_name),
           phone_normalized = COALESCE(VALUES(phone_normalized), phone_normalized),
           address_text = VALUES(address_text),
           preferred_payment_method = VALUES(preferred_payment_method),
           preferred_category = VALUES(preferred_category),
           locale = VALUES(locale),
           last_intent = VALUES(last_intent),
           channels_json = VALUES(channels_json),
           last_seen_at = UTC_TIMESTAMP(),
           updated_at = CURRENT_TIMESTAMP`,
        [
          canonicalId,
          displayName || null,
          normalizedPhone,
          addressText || null,
          paymentMethod,
          preferredCategory || null,
          locale || null,
          lastIntent || null,
          JSON.stringify(channels),
        ],
      );

      await connection.commit();
      return { canonicalId };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  async getByIdentity(channel: BackendChannel, userId: string): Promise<CustomerProfileView | null> {
    const [identityRows] = await this.pool.query<IdentityRow[]>(
      `SELECT channel, user_id, canonical_id
       FROM chat_user_identities
       WHERE channel = ? AND user_id = ?
       LIMIT 1`,
      [channel, userId],
    );
    const identity = identityRows[0];
    if (!identity) {
      return null;
    }

    const [profileRows] = await this.pool.query<ProfileRow[]>(
      `SELECT canonical_id, display_name, phone_normalized, address_text, preferred_payment_method,
              preferred_category, locale, last_intent, channels_json, last_seen_at, created_at, updated_at
       FROM chat_user_profiles
       WHERE canonical_id = ?
       LIMIT 1`,
      [identity.canonical_id],
    );
    const profile = profileRows[0];
    if (!profile) {
      return null;
    }

    const [linkedRows] = await this.pool.query<IdentityRow[]>(
      `SELECT channel, user_id, canonical_id
       FROM chat_user_identities
       WHERE canonical_id = ?
       ORDER BY updated_at DESC`,
      [identity.canonical_id],
    );

    return {
      canonicalId: identity.canonical_id,
      identities: linkedRows.map((row) => ({ channel: row.channel, userId: row.user_id })),
      profile: {
        name: profile.display_name || undefined,
        phone: profile.phone_normalized || undefined,
        address: profile.address_text || undefined,
        paymentMethod: profile.preferred_payment_method || undefined,
        preferredCategory: profile.preferred_category || undefined,
        locale: profile.locale || undefined,
        lastIntent: profile.last_intent || undefined,
        channels: mergeChannels(profile.channels_json),
        lastSeenAt: toIso(profile.last_seen_at),
        updatedAt: toIso(profile.updated_at),
      },
    };
  }

  private async getIdentity(connection: PoolConnection, channel: BackendChannel, userId: string): Promise<IdentityRow | null> {
    const [rows] = await connection.query<IdentityRow[]>(
      `SELECT channel, user_id, canonical_id
       FROM chat_user_identities
       WHERE channel = ? AND user_id = ?
       LIMIT 1`,
      [channel, userId],
    );
    return rows[0] || null;
  }

  private async getProfileByPhone(connection: PoolConnection, phoneNormalized: string): Promise<ProfileRow | null> {
    const [rows] = await connection.query<ProfileRow[]>(
      `SELECT canonical_id, display_name, phone_normalized, address_text, preferred_payment_method,
              preferred_category, locale, last_intent, channels_json, last_seen_at, created_at, updated_at
       FROM chat_user_profiles
       WHERE phone_normalized = ?
       ORDER BY updated_at DESC
       LIMIT 1`,
      [phoneNormalized],
    );
    return rows[0] || null;
  }

  private async getProfileByCanonicalId(connection: PoolConnection, canonicalId: string): Promise<ProfileRow | null> {
    const [rows] = await connection.query<ProfileRow[]>(
      `SELECT canonical_id, display_name, phone_normalized, address_text, preferred_payment_method,
              preferred_category, locale, last_intent, channels_json, last_seen_at, created_at, updated_at
       FROM chat_user_profiles
       WHERE canonical_id = ?
       LIMIT 1`,
      [canonicalId],
    );
    return rows[0] || null;
  }
}

function buildCanonicalId(channel: BackendChannel, userId: string): string {
  return `${channel}:${String(userId).slice(0, 96)}`.slice(0, 128);
}

function normalizePhone(value?: string): string | null {
  const digits = String(value || "").replace(/\D+/g, "");
  if (digits.length < 9 || digits.length > 15) {
    return null;
  }
  if (/^0+$/.test(digits)) {
    return null;
  }
  return digits;
}

function firstNonEmpty(...values: Array<string | undefined | null>): string | undefined {
  for (const value of values) {
    const trimmed = String(value || "").trim();
    if (trimmed) {
      return trimmed;
    }
  }
  return undefined;
}

function trimTo(value: string | undefined, maxLen: number): string | undefined {
  const raw = String(value || "").trim();
  if (!raw) {
    return undefined;
  }
  return raw.slice(0, maxLen);
}

function mergeChannels(existingJson?: string, incoming?: BackendChannel): BackendChannel[] {
  const merged = new Set<BackendChannel>();
  try {
    const parsed = JSON.parse(existingJson || "[]");
    if (Array.isArray(parsed)) {
      for (const entry of parsed) {
        if (entry === "telegram" || entry === "web" || entry === "messenger") {
          merged.add(entry);
        }
      }
    }
  } catch {
    // Ignore invalid persisted json; recover with incoming channel.
  }
  if (incoming) {
    merged.add(incoming);
  }
  return Array.from(merged.values());
}

function toIso(value: Date | string): string {
  return new Date(value).toISOString();
}
