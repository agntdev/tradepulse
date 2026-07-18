# Trading Signals Bot — Bot specification

**Archetype:** custom

**Voice:** professional and concise — write every user-facing message, button label, error, and empty state in this voice.

Distributes trade signals via Telegram DMs and a public channel. Admins manually grant premium access to users who receive full signal details, while standard users get high-level signals. Supports opt-out/re-subscribe flows and maintains signal history with timestamps.

> This is the complete contract for the bot. Implement EVERY entry point, flow, feature, integration, and edge case below. The completeness review checks the bot against this document after each build pass.

## Primary audience

- Retail traders
- Market followers
- Admin team

## Success criteria

- Users receive signals via DMs based on subscription status
- Public channel posts high-level signals consistently
- Admins can manually manage premium access and signal distribution

## Entry points

Every feature must be reachable from the bot's command/button surface (button-first; only /start and /help are slash commands).

- **/start** (command, actor: user, command: /start) — Register user and show help/status
  - outputs: Welcome message, Current subscription status
- **/status** (command, actor: user, command: /status) — Display user's premium status and last signal timestamp
  - outputs: Premium status, Last signal timestamp
- **/unsubscribe** (command, actor: user, command: /unsubscribe) — Stop receiving DM alerts (remain in public feed)
  - outputs: Opt-out confirmation
- **/help** (command, actor: user, command: /help) — Show usage instructions and support contact
  - outputs: Help text, Support contact info
- **Send Signal** (command, actor: admin, command: /sendsignal) — Open signal creation interface for admins

## Flows

### Signal Distribution
_Trigger:_ /sendsignal

1. Admin selects signal type (public/premium)
2. Chooses delivery target (channel/DMs/both)
3. Enters signal details
4. System formats and distributes messages

_Data touched:_ signal, user

### User Registration
_Trigger:_ /start

1. Verify user ID
2. Create user record if new
3. Display current status and help

_Data touched:_ user

### Subscription Management
_Trigger:_ /unsubscribe

1. Toggle opt-out flag
2. Confirm status change

_Data touched:_ user

## Data entities

Durable data (must survive a restart) uses the toolkit's persistent store, never in-memory maps.

- **user** _(retention: persistent)_ — Registered Telegram user with subscription status
  - fields: telegram_id, username, is_premium, is_opted_out, registered_at, last_signal_received
- **signal** _(retention: persistent)_ — Trade signal with metadata
  - fields: symbol, direction, signal_type, timestamp, admin_id, entry_price, stop_loss, take_profit, recommended_size, confidence_level, rationale
- **admin** _(retention: persistent)_ — Authorized administrator with signal-sending permissions
  - fields: telegram_id, permissions

## Integrations

- **Telegram** (required) — Bot API messaging, public channel, and admin interface
Call external APIs against their real contract (correct endpoints, ids, params); credentials from env. Do not fake responses.

## Owner controls

- Grant/revoke premium access via /grantpremium command
- Send signals with /sendsignal command specifying type and targets
- View user subscription status in admin interface

## Notifications

- Signal alerts via Telegram DMs
- Public channel posts
- Admin confirmation messages

## Permissions & privacy

- User data stored securely (IDs, status flags only)
- No third-party data sharing
- Opt-out users remain in public feed but not DM distribution

## Edge cases

- User unsubscribes but admin needs to send urgent DM
- Multiple admins sending conflicting signals simultaneously
- Telegram message delivery failures during market events

## Required tests

- Verify DM content differs between premium and standard users
- Test opt-out prevents DMs but preserves channel access
- Validate admin controls for signal type and distribution targets

## Assumptions

- Admins will use /sendsignal command for all alerts
- Signal formatting follows strict template rules
- User opt-out status is respected across all DM flows
