# Visual Implementation Guide
## MedCore Premium Enterprise Hospital Management System

**Version:** 1.0
**Date:** August 30, 2026

---

## 1. Design Philosophy

MedCore Premium is a high-precision enterprise health platform designed for high-stakes clinical environments. The brand personality is **Authoritative, Clinical, and Efficient**. It moves away from the typical "friendly" healthcare aesthetic toward a "Command Center" feel — prioritizing data density, rapid scanning, and institutional reliability.

The visual style is **Corporate Modern** with a focus on **fidelity** to real clinical software. It uses a deep emerald primary palette for stability and growth, paired with a sophisticated blue-tinted neutral system. The interface relies on tonal layering and subtle borders rather than heavy shadows or decorative effects.

**Non-negotiable principles:**
- No gradients
- No glassmorphism
- No consumer-style redesign
- No decorative elements that do not serve information density
- Enterprise healthcare UI with compact, professional layout

---

## 2. Canonical DS1 Identity

**Name:** Clinical Precision
**Asset ID:** `assets/72ec9756c9254e699503a3da16280a2d`

This is the **only** canonical implementation design system. All visual implementation must reference DS1.

**Other design systems (DS2, etc.) are preserved in Stitch but are NOT implementation references.**

---

## 3. Exact Color Tokens

### Primary Palette

| Token | Hex | Usage |
|-------|-----|-------|
| Primary | `#064E3B` | Buttons, active states, primary actions |
| Primary Foreground | `#FFFFFF` | Text on primary surfaces |
| Secondary | `#1E293B` | Navigation headers, sidebar background |
| Secondary Foreground | `#FFFFFF` | Text on secondary surfaces |

### Neutral Palette

| Token | Hex | Usage |
|-------|-----|-------|
| Background | `#F8F9FF` | Page background |
| Foreground | `#0B1C30` | Main text color |
| Card | `#FFFFFF` | Card backgrounds |
| Card Foreground | `#0B1C30` | Text on cards |
| Muted | `#F1F5F9` | Subtle backgrounds |
| Muted Foreground | `#64748B` | Secondary text |
| Border | `#E2E8F0` | Card borders, table borders |
| Input | `#E2E8F0` | Input field borders |
| Ring | `#064E3B` | Focus rings |

### Semantic Palette

| Token | Hex | Usage |
|-------|-----|-------|
| Destructive | `#BA1A1A` | Errors, critical alerts |
| Success | `#064E3B` | Positive indicators |
| Warning | `#B45309` | Caution indicators |

### Status Colors

| Status | Background | Text | Usage |
|--------|------------|------|-------|
| Available/Active | `#E6F4ED` | `#064E3B` | Available staff, active patients |
| In Progress | `#E0F2FE` | `#0369A1` | Consultations in progress |
| Critical | `#FEE2E2` | `#BA1A1A` | Critical patients, alerts |
| Warning | `#FEF3C7` | `#B45309` | Caution states |
| Completed | `#E6F4ED` | `#064E3B` | Completed tasks |
| Discharged | `#F1F5F9` | `#64748B` | Discharged patients |

---

## 4. Typography

### Font Families

| Usage | Font | CSS Value |
|-------|------|-----------|
| Headlines & Titles | Plus Jakarta Sans | `'Plus Jakarta Sans', sans-serif` |
| Body Text & Labels | Inter | `'Inter', sans-serif` |

### Type Scale

| Level | Font | Size | Weight | Line Height | Letter Spacing | Usage |
|-------|------|------|--------|-------------|----------------|-------|
| display-lg | Plus Jakarta Sans | 48px | 700 | 56px | -0.02em | Hero headings |
| headline-lg | Plus Jakarta Sans | 32px | 600 | 40px | -0.01em | Page titles |
| headline-md | Plus Jakarta Sans | 24px | 600 | 32px | — | Section headers |
| title-lg | Plus Jakarta Sans | 20px | 600 | 28px | — | Card titles |
| body-lg | Inter | 16px | 400 | 24px | — | Body text |
| body-md | Inter | 14px | 400 | 20px | — | Table data, form labels |
| label-md | Inter | 12px | 500 | 16px | 0.05em | Labels, KPI values |
| code-sm | Inter | 12px | 400 | 16px | — | Code, technical data |

### Typography Rules

- Use `label-md` in **ALL CAPS** for section headers within sidebars and table headers.
- Use Semi-Bold (600) for interactive titles and section headers.
- Use Medium (500) for labels and badges.
- Use Regular (400) for body text and table data.
- Maintain minimum contrast ratio of 4.5:1 for all text against backgrounds.

---

## 5. Spacing

### Spacing Scale

| Token | Value | Usage |
|-------|-------|-------|
| unit | 4px | Base unit |
| stack-sm | 8px | Compact spacing |
| stack-md | 16px | Standard spacing |
| gutter | 24px | Column gaps |
| stack-lg | 32px | Section spacing |
| margin-desktop | 32px | Page margins on desktop |
| margin-mobile | 16px | Page margins on mobile |

### Layout

- **Max container width:** 1440px (centered with auto margins)
- **Sidebar width:** 256px (fixed)
- **Grid:** 12-column fluid grid
- **Rhythm:** 4px baseline grid

---

## 6. Radius

| Token | Value | Usage |
|-------|-------|-------|
| sm | 0.125rem (2px) | Subtle rounding |
| DEFAULT | 0.25rem (4px) | Buttons, inputs, badges |
| md | 0.375rem (6px) | Medium elements |
| lg | 0.5rem (8px) | Cards, containers |
| xl | 0.75rem (12px) | Large modals |
| full | 9999px | Avatars, pills |

**Rules:**
- Buttons: 4px radius
- Inputs: 4px radius
- Cards: 8px radius
- Badges: 4px radius
- Avatars: full (circular)
- Dialogs: 12px radius

---

## 7. Borders

- **Default border:** 1px solid `#E2E8F0`
- **Table header border:** 1px solid `#F1F5F9` (lighter)
- **Card border:** 1px solid `rgba(226, 232, 240, 0.5)` (30-50% opacity)
- **Focus ring:** 2px solid `#064E3B` with 2px offset
- **No thick borders.** Keep borders subtle and lightweight.

---

## 8. Shadows

Shadows are **restrained and minimal**.

| Level | Shadow | Usage |
|-------|--------|-------|
| sm | `0 1px 2px rgba(0,0,0,0.05)` | Cards, containers |
| md | `0 4px 6px rgba(0,0,0,0.05)` | Hover states |
| lg | `0 10px 15px rgba(0,0,0,0.05)` | Dropdowns, popovers |

**Rules:**
- Never use colored shadows.
- Never use large dramatic shadows.
- Prefer tonal layering (background color differences) over shadows for depth.

---

## 9. Page Background

```css
body {
  background-color: #F8F9FF;
}
```

- All pages use `#F8F9FF` as the base background.
- Cards use `#FFFFFF` to create visual separation.
- No page-level gradients or patterns.

---

## 10. Card Design

```css
.card {
  background: #FFFFFF;
  border-radius: 8px;
  border: 1px solid rgba(226, 232, 240, 0.5);
  box-shadow: 0 1px 2px rgba(0,0,0,0.05);
}
```

- White background
- 8px radius
- Subtle border (226, 232, 240 at 30-50%)
- Minimal shadow
- Card headers have a subtle 1px bottom border in `#F1F5F9`

---

## 11. Sidebar

```css
.sidebar {
  width: 256px;
  background: #1E293B;  /* secondary */
  color: rgba(255, 255, 255, 0.7);
  position: fixed;
  height: 100vh;
}
```

- **Background:** `#1E293B` (dark navy)
- **Text:** `rgba(255, 255, 255, 0.7)` (70% white)
- **Active text:** `#FFFFFF` (full white)
- **Active indicator:** 4px left border in `#064E3B` (forest green)
- **Hover:** `rgba(255, 255, 255, 0.1)` background
- **Width:** 256px fixed
- **Logo:** Top of sidebar, white text or logo SVG

---

## 12. Topbar

```css
.topbar {
  height: 64px;
  background: #FFFFFF;
  border-bottom: 1px solid #E2E8F0;
  backdrop-filter: blur(8px);  /* for scroll context */
}
```

- **Background:** `#FFFFFF` with subtle border
- **Height:** 64px
- **Contains:** Search input (pill shape, full radius), notification bell, user avatar + name
- **Search:** Pill-shaped (full radius), placeholder "Search patients, records..."

---

## 13. Page Headers

Every page follows this structure:

```tsx
<div className="mb-6">
  <Breadcrumb items={[...]} />
  <div className="flex items-center justify-between">
    <div>
      <h1 className="text-3xl font-semibold text-[#0B1C30]">Page Title</h1>
      <p className="text-sm text-[#64748B] mt-1">Subtitle description</p>
    </div>
    <div className="flex gap-2">
      {/* Action buttons */}
    </div>
  </div>
</div>
```

- Title: `headline-lg` (32px, 600 weight, `#0B1C30`)
- Subtitle: `body-md` (14px, 400 weight, `#64748B`)
- Breadcrumb above title

---

## 14. Breadcrumbs

```tsx
<Breadcrumb>
  <BreadcrumbLink href="/">Dashboard</BreadcrumbLink>
  <BreadcrumbSeparator>/</BreadcrumbSeparator>
  <BreadcrumbLink href="/patients">Patients</BreadcrumbLink>
  <BreadcrumbSeparator>/</BreadcrumbSeparator>
  <BreadcrumbCurrent>Sarah Jenkins</BreadcrumbCurrent>
</Breadcrumb>
```

- Uses `label-md` (12px, 500 weight, `#64748B`)
- Separator: `/` character
- Current page: `#0B1C30` (bold)
- Links: `#64748B` (hover: `#064E3B`)

---

## 15. Buttons

### Primary Button

```css
.btn-primary {
  background: #064E3B;
  color: #FFFFFF;
  border-radius: 4px;
  padding: 8px 16px;
  font-size: 14px;
  font-weight: 500;
}
```

- **Background:** `#064E3B`
- **Text:** `#FFFFFF`
- **Radius:** 4px
- **Hover:** `#054231` (slightly darker)
- **Active:** `#043627` (even darker)

### Secondary/Outlined Button

- **Background:** `#FFFFFF`
- **Border:** 1px solid `#E2E8F0`
- **Text:** `#0B1C30`
- **Hover:** `#F8F9FF` background

### Ghost Button

- **Background:** transparent
- **Text:** `#0B1C30`
- **Hover:** `#F1F5F9` background

### Rules
- All buttons use `label-md` (12px, 500, uppercase) or `body-md` (14px, 500)
- Padding: `8px 16px` (compact) or `12px 24px` (standard)
- Icon buttons: 36px x 36px with icon centered
- Loading state: spinner replaces text, button disabled

---

## 16. Inputs

```css
.input {
  background: #FFFFFF;
  border: 1px solid #E2E8F0;
  border-radius: 4px;
  padding: 8px 12px;
  font-size: 14px;
  color: #0B1C30;
}

.input:focus {
  border-color: #064E3B;
  outline: 2px solid rgba(6, 78, 59, 0.2);
}

.input::placeholder {
  color: #94A3B8;
}
```

- **Background:** `#FFFFFF`
- **Border:** 1px solid `#E2E8F0`
- **Radius:** 4px
- **Padding:** 8px 12px
- **Font:** Inter 14px
- **Focus:** Border `#064E3B` with 2px ring
- **Error:** Border `#BA1A1A`

---

## 17. Selects

Same styling as inputs with a dropdown chevron icon.

---

## 18. Textareas

Same styling as inputs with multi-line support and vertical resize.

---

## 19. Tables

```css
.table-header {
  background: #F8F9FF;
  font-size: 12px;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #64748B;
  border-bottom: 1px solid #E2E8F0;
}

.table-row {
  border-bottom: 1px solid #F1F5F9;
}

.table-row:hover {
  background: rgba(241, 245, 249, 0.5);
}
```

- **Header:** `#F8F9FF` background, `label-md` uppercase, `#64748B` text
- **Row border:** 1px solid `#F1F5F9` (horizontal only)
- **Hover:** `rgba(241, 245, 249, 0.5)`
- **Cell padding:** 12px 16px
- **Font:** Inter 14px (`body-md`)

---

## 20. Status Badges

| Status | Background | Text | Border |
|--------|------------|------|--------|
| Active | `#E6F4ED` | `#064E3B` | none |
| Available | `#E6F4ED` | `#064E3B` | none |
| In Progress | `#E0F2FE` | `#0369A1` | none |
| Critical | `#FEE2E2` | `#BA1A1A` | none |
| Warning | `#FEF3C7` | `#B45309` | none |
| Completed | `#E6F4ED` | `#064E3B` | none |
| Discharged | `#F1F5F9` | `#64748B` | none |
| Scheduled | `#E0F2FE` | `#0369A1` | none |

- **Font:** `label-md` (12px, 500)
- **Padding:** 4px 12px
- **Radius:** 4px
- **Light background** with **dark text** of the same hue

---

## 21. Alerts

| Type | Background | Border | Text | Icon |
|------|------------|--------|------|------|
| Info | `#E0F2FE` | `#BAE6FD` | `#0369A1` | ℹ |
| Success | `#E6F4ED` | `#A7F3D0` | `#064E3B` | ✓ |
| Warning | `#FEF3C7` | `#FDE68A` | `#B45309` | ⚠ |
| Error | `#FEE2E2` | `#FECACA` | `#BA1A1A` | ✗ |

- **Radius:** 4px
- **Padding:** 12px 16px
- **Font:** `body-md`

---

## 22. Tabs

- **Active:** `#064E3B` bottom border, `#0B1C30` text
- **Inactive:** No border, `#64748B` text
- **Font:** `body-md` (14px, 500)
- **Padding:** 12px 16px per tab

---

## 23. Dialogs

```css
.dialog {
  background: #FFFFFF;
  border-radius: 12px;
  box-shadow: 0 20px 25px rgba(15, 23, 42, 0.1);
  max-width: 480px;
}
```

- **Radius:** 12px
- **Overlay:** `rgba(0, 0, 0, 0.5)`
- **Padding:** 24px
- **Title:** `headline-md`
- **Body:** `body-md`

---

## 24. Progress Steppers

- **Active step:** `#064E3B` circle, white checkmark
- **Completed step:** `#064E3B` circle, white checkmark
- **Pending step:** `#E2E8F0` circle, `#64748B` number
- **Connector line:** `#E2E8F0` (completed: `#064E3B`)

---

## 25. Forms

- Labels above inputs, `label-md` (12px, 500, uppercase)
- Required fields: asterisk `*` in `#BA1A1A`
- Error messages: `body-sm` (12px) in `#BA1A1A` below input
- Helper text: `body-sm` (12px) in `#64748B` below input
- Field spacing: 16px between fields
- Section spacing: 24px between form sections

---

## 26. Dashboard Cards

- **Stats cards:** Number in `headline-lg`, label in `label-md`
- **Chart cards:** Title in `title-lg`, chart fills remaining height
- **Action cards:** Icon + label, clickable with hover state

---

## 27. Charts

### Color Palette

| Color | Hex | Usage |
|-------|-----|-------|
| Primary | `#064E3B` | Primary data series |
| Secondary | `#1E293B` | Secondary data series |
| Accent | `#B45309` | Accent/tertiary data |
| Muted | `#94A3B8` | Reference lines, grid |
| Surface | `#F8F9FF` | Chart background |

### Rules
- Use only the DS1 palette for chart colors
- No neon or bright colors
- Grid lines: `#F1F5F9`
- Axis labels: `label-md` in `#64748B`
- Tooltip: white background, subtle border

---

## 28. Empty States

```tsx
<div className="flex flex-col items-center justify-center py-12">
  <Icon className="w-12 h-12 text-[#94A3B8] mb-4" />
  <h3 className="text-lg font-semibold text-[#0B1C30] mb-1">No data found</h3>
  <p className="text-sm text-[#64748B] mb-4">Description of what to do</p>
  <Button>Action</Button>
</div>
```

- **Icon:** 48px, `#94A3B8`
- **Title:** `title-lg` in `#0B1C30`
- **Description:** `body-md` in `#64748B`
- **Action button:** Primary

---

## 29. Loading States

- **Page skeleton:** Rectangular blocks matching layout proportions
- **Table skeleton:** 5-10 rows of shimmer blocks
- **Card skeleton:** Card shape with shimmer
- **Button spinner:** 16px spinner centered in button
- **Shimmer color:** `#F1F5F9` to `#E2E8F0` animation

---

## 30. Error States

- **Page error:** Centered message with retry button
- **Form error:** Red border on invalid fields, error message below
- **Table error:** Inline error row with retry
- **API error:** Toast notification with error message
- **404 page:** Illustration + "Page not found" + home link

---

## 31. Responsive Rules

| Breakpoint | Sidebar | Layout | Margins |
|------------|---------|--------|---------|
| Desktop (≥1280px) | Fixed 256px | Multi-column | 32px |
| Tablet (768-1279px) | Collapsible | Stacked | 16px |
| Mobile (<768px) | Hidden (drawer) | Single column | 16px |

### Rules
- Sidebar becomes a slide-out sheet on tablet/mobile
- Tables become horizontally scrollable on mobile
- Forms stack vertically on mobile
- Stats cards stack on mobile
- Chart cards stack on mobile
- Dialogs become full-screen sheets on mobile

---

## 32. Accessibility Visual Rules

- **Focus indicators:** 2px solid `#064E3B` with 2px offset on all focusable elements
- **Color contrast:** Minimum 4.5:1 for text, 3:1 for large text
- **Text size:** Never below 12px
- **Touch targets:** Minimum 44px x 44px for interactive elements
- **Icons:** Always paired with text labels (no icon-only buttons without aria-label)
- **Error states:** Use both color and text (never color alone)

---

## 33. Reference Screen Hierarchy

### Canonical Primary Screens (Use as main visual references)

| Module | Screen Title | Screen ID |
|--------|--------------|-----------|
| Dashboard | Hospital Operations Dashboard | `57eb9594c057479e9f0ebc7aac6fcc78` |
| Patients | Patient Management - MedCore Premium | `06c808187a414228951efbc4d8b2c27e` |
| Patient Record | Patient Record - Sarah Jenkins | `83179e75c63d4b178157081e6dc4fc35` |
| Appointments | Appointments & Scheduling | `054d829f7cc84db1a00525daa4353b3d` |
| Staff | Doctors & Staff Management | `2614dc212ec8464aaef54d2a5aee50f0` |
| Departments | Departments & Units | `a55806e461bf43f0ac1d6bc4a7077bb1` |
| Beds | Beds & Rooms Operations Command Center | `608f91df6ecd42e1b36bc0102a54cbc6` |
| Emergency | Emergency Command Center | `f3cf7efa0b684a3ab53db975f8b81900` |
| Pharmacy | Pharmacy Management | `7350e94a841d49f383ff40bdbb8c722c` |
| Laboratory | Laboratory & Diagnostics | `fe1d646d4f2b426792af7ee7b78c50ea` |
| Inventory | Inventory Management | `172038fc7b984f36b5d31f511781f8b8` |
| Billing | Billing & Payments | `4c8d1d1b0c48477db5a0b6315210d54f` |
| Insurance | Insurance & Claims | `120b8110231c496b984bfbcc32d9dae9` |
| Reports | Reports & Analytics | `fb4e8fba80e846139bca1494d78bf6f4` |
| Users | Users & Roles Administration | `16fab73369a94268afd72416ffae0cff` |
| Notifications | Notifications & Communication | `fc980b9e994844df9c9cf2e5f1b4f86f` |
| Security | Security & Access Control | `e702fa48d63449f3bf968d1fec32eb06` |
| Settings | Settings & Administration | `c80cd8180d024f0097e7a93b16517196` |

### Unique Workflow Reference Screens

| Module | Screen Title | Screen ID |
|--------|--------------|-----------|
| Mobile | Hospital Operations Dashboard - Mobile | `f940c592fae841a9b2ba7f923d8243e6` |
| Registration | New Patient Registration | `6b714d4db90041ba92a7fe2a89489345` |
| Clinical Profile | Patient Clinical Profile | `223fe23597a643f1936374d55f6bad74` |
| New Appointment | New Appointment | `733131681e534504a2235524f528455b` |
| Appointment Details | Appointment Details | `08e62c0238004a1ab135f0f4aa314a02` |
| Staff Profile | Staff Profile - Dr. Sarah Patel | `ff9990e9d6e94b329a8800ab0ddf3269` |
| Schedule | Doctor Availability & Schedule | `470a5bfce19e4fe8ac446fb63e262e00` |
| Dept Details | Department Details - Cardiology | `a5d0f64eb3914a52946aed3dd2e1acb9` |
| Admissions | Admissions Management | `93c573674ba441e8b403ad2ba45890dc` |
| Pharmacy Detail | Pharmacy & Medication | `f114e2ef5b8a42439c56c58276ae2509` |
| Lab Variant | Laboratory & Diagnostics | `67eac30da59d480894155f55043f31f9` |
| Purchase Orders | Purchase Order Management | `9286cd1f74e748dcae0c3b2a5315fec6` |
| PO Details | Purchase Order Details | `eab9f996557649bdb8b2d042d2d9f513` |
| Staff Schedule | Dr. Sarah Patel - Schedule & Leave | `1d67d8aca2774914b56d61f5876bc40b` |

### Newly Created P0/P1 Screens

| Priority | Screen Title | Screen ID |
|----------|--------------|-----------|
| P0 | Login & Authentication | `aa1fd8bce1eb4efd8b839be8aada7bf6` |
| P0 | New Patient Admission | `49c93f636a144412b2d46d0836621af7` |
| P0 | Discharge Summary | `7ff127bb2f904067a76e783460d57b24` |
| P0 | Doctor Prescription & Orders | `d0cc602b0871494aadb4c06e9cbd9295` |
| P0 | Medical Records & Documents | `d843e7d084b64a2b9be85d3052da077b` |
| P0 | Doctor Consultation | `77e0cbcb07c646899e52c45798cfb93a` |
| P1 | Nurse Station Dashboard | `4f63da3aaa9a4a14bda59af5e79b9ca3` |
| P1 | Surgery & Operating Theater Schedule | `261d8d74080741b9b4d05587f0e6115a` |
| P1 | Security Audit Log | `b45ffa972b2249ceb8ecfc5f34475bc0` |

### screens NOT Used as References

Duplicate screen variants, experimental screens, and superseded screens from the Stitch generation process are **NOT** visual sources of truth. They are preserved in the Stitch archive but must not be used as implementation references.

---

## 34. Reference Patient Data

Use consistent fictional demo data across all clinical UI examples:

| Field | Value |
|-------|-------|
| Name | Sarah Jenkins |
| Patient ID | PT-10482 |
| Age | 42 |
| Gender | Female |
| Blood Group | O+ |
| Department | Cardiology |
| Attending Doctor | Dr. Sarah Patel |
| Phone | +1 555 010 2482 |
| Allergies | Penicillin (Reaction: Rash) |
| Active Conditions | Stable Angina, Hypertension |
| Current Medications | Aspirin, Atorvastatin |

---

*This document is the visual implementation source of truth. All UI implementation must conform to these guidelines.*
