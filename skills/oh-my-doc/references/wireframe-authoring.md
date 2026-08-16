# Wireframe authoring

Use this when filling a `layout` or `screen-state` HTML row. Placement and
viewport tokens are in [`html-document-contract.md`](./html-document-contract.md).
This file is the **content** contract — how a good mock looks and what to type.

Wireframes are **structural**. They name regions and actions. They are not
visual design, not a screenshot, and not a Tailwind playground.

## Required shape

1. After `header.omd-doc-header`, before `main.omd-doc-body`.
2. Two sections, **mobile then desktop**:
   `data-omd-wireframe="mobile"` then `data-omd-wireframe="desktop"`.
3. Each section wraps a **device**:
   - Mobile: `<div class="omd-wire-device omd-wire-device-mobile">`
   - Desktop: `<div class="omd-wire-device omd-wire-device-desktop">`

Do not invent a third viewport. Do not drop chrome to “save space”.

## Chrome (keep the template)

**Mobile** (top → bottom):

| Class | Role |
|---|---|
| `omd-wire-mobile-bar` | Product or screen title |
| `omd-wire-body` | Regions for this layout/state |
| `omd-wire-mobile-tabbar` | Optional; ≤5 destinations; mark `.active` |

**Desktop**:

| Class | Role |
|---|---|
| `omd-wire-shell` | Sidebar + main |
| `omd-wire-sidebar` | Persistent nav; mark `.active` |
| `omd-wire-crumb` | `Home / … / this screen` |
| `omd-wire-body` | Same regions as mobile |

Shell/chrome layouts (`tier` = 껍데기) still use both devices. Leave the body
slot as one empty `omd-wire-block` labeled `Body slot`.

## Block kit (use only these)

Inside `omd-wire-body`, compose from this kit. Shared CSS styles them — do not
add Tailwind, inline styles, `<img>`, emoji-as-icon, or custom colors.

| Class | Use for |
|---|---|
| `omd-wire-block` | Named region (header cluster, summary, related) |
| `omd-wire-block is-primary` | The one thing this screen is for |
| `omd-wire-row` | One repeating list/item row |
| `omd-wire-field` | One labeled input (`Label · value`) |
| `omd-wire-actions` | Button row; put the main action first with `is-primary` |
| `omd-wire-status` | Loading, empty, error, success banner |

Label every piece with **2–6 product words** (the real region name). Never
“Primary content”, “Block 1”, or lorem.

```html
<div class="omd-wire-block is-primary">Inbox</div>
<div class="omd-wire-row">Note · yesterday</div>
<div class="omd-wire-row">Note · last week</div>
<div class="omd-wire-actions">
  <span class="is-primary">New note</span>
  <span>Filter</span>
</div>
```

## Density and pairing

- **3–8** kit pieces per viewport (not counting chrome).
- Mobile and desktop show the **same regions** in the same order. Only chrome
  and wrapping change (tab bar vs sidebar, stacked vs two-column).
- Exactly **one** `is-primary` cluster or action per viewport.
- Tab bar / sidebar labels match the product IA units, not placeholder “Item”.

## Layout vs screen-state

| Kind | Body shows |
|---|---|
| Layout | Default populated structure of the shell or page skeleton |
| Screen-state | The same chrome, with body changed for **this** state |

One state per file (`STA-*`). Loading / empty / error / selected are sibling
rows, not extra boxes on the default mock.

Put hover, toast, or keyboard-only behavior in the narrative body — not as a
fake third wireframe.

## Do not

- Pixel-perfect UI, illustrations, photos, brand palettes
- Paragraphs of explanation inside the mock (that belongs in `.omd-doc-body`)
- A different information architecture on desktop than on mobile
- Dumping the whole app into one layout
- `data-omd-wireframe="shell"` / `"body"` as the required split (see ADR-7)

## Check

`omd check` requires the two viewports, top placement, matching device
wrappers, and at least one kit class per viewport. Humans/agents still apply
labeling, density, and same-region pairing from this file.
