# Combo billing fix in cart

## Problem
When a combo is added to the cart, each included product is inserted as a separate cart line at its own `unit_price`. The cart then bills the **sum of individual unit prices**, which can differ from the combo's discounted `combo_price`. Customers can also change quantity or remove individual combo items, breaking the bundle.

## Goal
1. Combo always bills at `combo_price` (one fixed amount), regardless of the unit prices of its items.
2. Customer cannot edit quantity or remove a single product inside a combo. They can only remove the whole combo.

## Approach (frontend-only)

### 1. Extend `CartItem` (src/hooks/useCart.tsx)
Add optional fields to each cart item:
- `combo_id?: string` — combo definition id
- `combo_instance_id?: string` — unique id per "added combo" (so the same combo added twice stays as two separate bundles)
- `combo_name?: string`
- `combo_locked?: boolean` — when true, quantity controls and individual remove are disabled

Add a helper `removeCombo(combo_instance_id)` that filters out all items sharing that id.

### 2. Update `ComboOffersSection.addComboToCart` (src/components/customer/ComboOffersSection.tsx)
When adding a combo:
- Generate one `combo_instance_id` (e.g. `crypto.randomUUID()`).
- Distribute `combo.combo_price` across the combo items proportionally to `unit_price * quantity`, so the **sum of `price * quantity` across the line items exactly equals `combo_price`** (rounded to 2 decimals, with last item absorbing the rounding remainder).
- Push each item with `combo_id`, `combo_instance_id`, `combo_name`, `combo_locked: true`, and `mrp` kept as the original product mrp so MRP savings still display correctly.
- To allow the same combo to coexist with the same product added separately, use a composite cart `id` of `${product_id}__${combo_instance_id}` for combo lines (regular product lines keep plain `id`). This sidesteps the existing "merge by id" logic in `addItem`.

### 3. Update `Cart.tsx` rendering
- Group items by `combo_instance_id` when present; render a single bordered card per combo with header `Combo: <combo_name>` and a single **Remove Combo** button (calls `removeCombo`).
- Inside the group, list each included product (image, name, qty) but hide the +/- buttons, the individual Remove button, and the per-item price/discount strip.
- Show the combo total as one line: `Combo price: ₹<combo_price>` (computed as the sum of the line `price * quantity` within the group, which equals `combo_price` by construction).
- Non-combo items render exactly as today.

### 4. Stock & checkout
No business-logic changes:
- Stock checks in `handlePlaceOrder` already key off `item.id` and `item.source`. Because combo lines use `${product_id}__${combo_instance_id}`, add a small shim: when checking stock and when mapping `mapOrderItems`, use `item.combo_id ? <real product_id from item> : item.id`. Store the real product id on the cart line as `product_id` so we don't have to parse the composite id.
- `totalPrice` (sum of `price * quantity`) automatically equals combo_price for that bundle, so subtotal, discounts, delivery, wallet, and order insertion all stay correct without further math changes.
- `mapOrderItems` will include `combo_id` and `combo_name` in the stored `items` JSON so admin/order views can show the combo grouping later.

## Files touched
- `src/hooks/useCart.tsx` — extend type, add `removeCombo`, accept composite ids.
- `src/components/customer/ComboOffersSection.tsx` — proportional price distribution + combo metadata when adding to cart.
- `src/pages/customer/Cart.tsx` — group-render combo items, lock controls, single remove button; pass `product_id` (not composite id) into stock checks and order items.

## Out of scope
- No DB migrations. No admin/order-page changes beyond the extra fields naturally appearing in `orders.items` JSON.
- Existing combos already in users' carts (added before this change) will continue to behave as separate items; only newly added combos get the new behavior.
