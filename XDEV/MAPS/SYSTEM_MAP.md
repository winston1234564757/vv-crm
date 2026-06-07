# SYSTEM MAP: VV CRM

## 1. Directory Structure
```
vv-crm/
├── .claude/                # AI Settings & Hooks
├── XDEV/                   # Architecture Maps & Specs
│   └── MAPS/
├── src/
│   ├── app/
│   │   ├── admin/          # Admin Dashboard (Guard Protected)
│   │   ├── repair/         # Public repair tracking
│   │   └── page.tsx        # Public showcase / landing
│   ├── components/
│   ├── lib/
│   │   ├── supabase/       # client.ts, server.ts, admin.ts
│   │   └── validations/    # Zod schemas
│   └── proxy.ts            # Routing Guard
├── AIDEVELOPER.md
└── IRON_RULES.md
```

## 2. Core Entities
- **Users (Admins/Staff)**: Management & operations. Protected by proxy guard.
- **Customers**: B2C clients tracked by phone/email.
- **Repairs**: Devices brought in for service (states: received, diagnosing, repairing, ready, completed).
- **Inventory**: Devices/accessories for sale.
