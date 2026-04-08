

# dMRV Inventory & Deployment Tracking Platform

## Overview
A full-stack platform for tracking physical hardware assets (cookstoves, IoT devices, sensors) across their entire lifecycle — from procurement to field deployment — with tamper-evident evidence at every stage. Built on Supabase for auth, database, storage, and edge functions.

---

## 1. Authentication & Role-Based Access

- Login/signup with email & password
- Four roles: **Admin**, **Warehouse Manager**, **Field Officer**, **Auditor** (read-only)
- Role-based navigation — each role sees only what they need
- Admin can manage users and assign roles

## 2. Dashboard (Homepage)

- **Summary cards**: Total Procured | In Warehouse | Deployed | Pending Deployment
- **Recent shipments** table with status badges
- **Recent deployments** table with status badges
- **Flagged issues** alert section (low stock, flagged deployments)
- **Stock level bars** by item category with color-coded thresholds (green/yellow/red)
- Quick-action buttons: Log Shipment, Log Deployment

## 3. Shipment Module

- **Shipment list** with filters (status, supplier, date range, item type)
- **Create shipment form**: item selection, quantity, origin country, supplier, expected/actual arrival dates
- **Status workflow**: Ordered → In Transit → Customs → Received → Partial
- **File attachments**: Upload invoices, packing lists, bills of lading, customs docs (PDF/image) with preview
- **Photo attachments**: Upload photos of packages/shipments on arrival
- On marking "Received", items auto-populate warehouse stock as a new stock batch
- **Shipment detail page** with full timeline and all attached evidence

## 4. Warehouse / Stock Module

- **Live inventory dashboard**: total received, deployed, available — grouped by item type and batch
- **Stock batch detail**: linked to source shipment, shows full history, photos, documents
- **Stock alerts**: configurable low-inventory thresholds with visual warnings
- **Manual stock adjustment**: form with reason field + evidence upload (for breakage, loss, corrections)
- **Batch traceability**: click any batch to see its origin shipment and any deployments it fed

## 5. Deployment Module

- **Deployment list** with filters (project, status, date, field officer)
- **Create deployment form** (mobile-optimized, completable in <2 minutes):
  - Select items from available stock batches
  - Assign to a project
  - Deployment date, location (GPS coordinates or region name)
  - Responsible field officer
- **Status workflow**: Scheduled → In Transit → Deployed → Verified → Flagged
- **Proof uploads**: photos of installed devices, signed delivery notes, GPS-tagged images
- **Verification step**: A supervisor/auditor must confirm with their own evidence before status moves to "Verified"
- **Full traceability**: each deployment links back to its stock batch and original shipment

## 6. Projects

- **Project list and detail pages** (e.g., "Uganda Cookstove Project Phase 1")
- Project view shows: target quantity, deployed count, pending, available in store
- All deployments grouped under their project
- Project-level map showing deployment locations

## 7. Evidence / Document Vault

- Central searchable repository of all uploaded files (photos + documents)
- Each file tagged with: linked item/batch, event type (shipment/deployment/audit), date, uploader
- GPS metadata auto-extracted from photos when available
- **Tamper-evident**: SHA-256 hash computed and stored on upload; files are immutable after submission
- Files can be flagged for review but never deleted
- Filters: project, item type, date range, event type, uploader

## 8. Item / Asset Management

- **Item catalog**: define item types (cookstove, IoT device, antenna, sensor, etc.)
- Each item type has: name, category, unit of measure, description, specifications
- Used across shipments, stock, and deployments for consistency

## 9. Audit Trail

- Every action logged: user, timestamp, action type, affected entity, before/after values
- Viewable audit log with filters (user, date range, entity type)
- **Chain-of-custody report** per item batch: a single timeline from factory to field with all evidence

## 10. Reporting & Export

- **CSV export** for data analysis (shipments, stock, deployments — filterable)
- **PDF report generation** via Supabase edge function for MRV submissions — branded, with timelines and evidence summaries
- **Chain-of-custody PDF**: verifiable report per batch showing full lifecycle with hashes

## 11. Map View

- Interactive map (Leaflet/OpenStreetMap) showing all deployment locations
- Markers color-coded by deployment status
- Click marker to see deployment details
- Filter by project, status, date range

## 12. Mobile-Friendly Design

- Fully responsive layout optimized for phone use by field officers
- Deployment form designed for quick field entry
- Camera-friendly photo upload with preview
- PWA setup with service worker for basic offline capability (queue uploads when connectivity returns)

## Design & UX

- **Dashboard-first**: homepage immediately shows key metrics and recent activity
- **Color-coded statuses**: green (deployed/verified), yellow (in transit/pending), red (flagged/low stock)
- **Vertical timeline** on item/batch detail pages showing each lifecycle stage with attached evidence
- Clean, professional UI using shadcn/ui components with a sidebar navigation
- Dark/light mode support

