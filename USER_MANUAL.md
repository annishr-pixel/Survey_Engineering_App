# Survey Engineering App - Complete Project Manual

**Version:** 1.0  
**Last Updated:** July 24, 2026  
**Project Name:** Treadlight Survey Engineering Application  
**Author:** Engineering Team

---

## Table of Contents

1. [Project Overview](#project-overview)
2. [System Architecture](#system-architecture)
3. [Technology Stack](#technology-stack)
4. [Database Schema](#database-schema)
5. [User Roles & Workflows](#user-roles--workflows)
6. [User Manual by Role](#user-manual-by-role)
7. [Feature Guide](#feature-guide)
8. [API & Integration](#api--integration)
9. [Troubleshooting](#troubleshooting)
10. [Support & Help](#support--help)

---

## 1. Project Overview

### 1.1 What is the Survey Engineering App?

The Survey Engineering App is a comprehensive platform designed to streamline solar PV (photovoltaic) and battery storage project management. It enables seamless collaboration between:

- **Sales Team**: Manage customer enquiries and approve survey requests
- **Surveyors**: Complete on-site technical surveys
- **Admin**: Manage system users and permissions

### 1.2 Key Features

✅ **Customer Survey Approval**: Sales team approves customer surveys  
✅ **Surveyor Assignment**: Assign trained surveyors to specific jobs  
✅ **Technical Survey Forms**: Comprehensive survey data collection  
✅ **Photo Upload**: Capture and store site photographs  
✅ **Final Quotation Management**: Review and approve final quotations  
✅ **User Management**: Create and manage system users with role-based access  
✅ **Lead Synchronization**: Real-time sync with Notion databases  
✅ **PDF Generation**: Generate initial estimation PDFs  
✅ **Report Generation**: Track survey completion and project status

### 1.3 Business Flow

```
Customer Enquiry
    ↓
[SALES TEAM] Approves Survey → Assigns Surveyor
    ↓
[SURVEYOR] Completes Site Survey → Uploads Photos & Data
    ↓
Survey Submitted → Proposal Generated
    ↓
[SALES TEAM] Reviews Quotation → Approves/Rejects
    ↓
Final Agreement & Installation Scheduling
```

---

## 2. System Architecture

### 2.1 Application Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    CLIENT LAYER                          │
│  (Next.js React Components - TypeScript)                 │
├─────────────────────────────────────────────────────────┤
│  Sales Dashboard │ Surveyor Jobs │ Admin Panel │ Reports │
├─────────────────────────────────────────────────────────┤
│                   API LAYER                              │
│  (Next.js API Routes & Server Actions)                   │
├─────────────────────────────────────────────────────────┤
│  Authentication │ User Management │ Survey Actions       │
│  Photo Upload   │ Approval Workflow │ Data Sync          │
├─────────────────────────────────────────────────────────┤
│                 DATABASE LAYER                           │
│  PostgreSQL (Primary) with Drizzle ORM                   │
├─────────────────────────────────────────────────────────┤
│  External Integrations                                   │
│  Notion API │ Vercel Blob Storage │ NextAuth            │
└─────────────────────────────────────────────────────────┘
```

### 2.2 Module Structure

```
/app
  ├── /(app)                          # Protected routes (require login)
  │   ├── /sales                      # Sales team dashboard
  │   │   ├── page.tsx                # Sales-Pitch (completed surveys)
  │   │   ├── /survey-approvals       # Approve/assign surveys
  │   │   ├── /final-quotation        # Review quotations
  │   │   ├── /admin                  # User management
  │   │   ├── /reports                # Generate reports
  │   │   └── /[jobId]                # Job detail view
  │   ├── /jobs                       # Surveyor dashboard
  │   │   ├── page.tsx                # Assigned jobs list
  │   │   └── /[jobId]                # Survey form page
  │   └── /layout.tsx                 # Protected layout with header

/components
  ├── /ui                             # Reusable UI components
  │   ├── button.tsx
  │   ├── card.tsx
  │   ├── field.tsx
  │   ├── hero-banner.tsx
  │   └── feature-hero.tsx

/lib
  ├── /db                             # Database operations
  │   ├── client.ts                   # DB connection
  │   ├── schema.ts                   # Table definitions
  │   └── surveys.ts                  # Survey queries
  ├── /notion                         # Notion API integration
  ├── auth.ts                         # Authentication setup
  └── utils.ts                        # Utility functions

/actions
  ├── approval.ts                     # Approval workflows
  ├── users.ts                        # User management
  └── survey.ts                       # Survey operations

/public
  └── images                          # Static assets
```

---

## 3. Technology Stack

### 3.1 Frontend Technologies

| Technology | Version | Purpose |
|-----------|---------|---------|
| Next.js | ^15.1.6 | React framework & routing |
| React | ^19.0.0 | UI library |
| TypeScript | Latest | Type safety |
| Tailwind CSS | Latest | Styling |
| Lucide React | ^0.469.0 | Icons |
| Motion | ^12.42.2 | Animations |
| React Hook Form | ^7.54.2 | Form handling |
| Zod | ^3.24.1 | Schema validation |

### 3.2 Backend Technologies

| Technology | Version | Purpose |
|-----------|---------|---------|
| Node.js | Latest | Runtime |
| Next.js API Routes | ^15.1.6 | Backend API |
| NextAuth | 5.0.0-beta.25 | Authentication |

### 3.3 Database & ORM

| Technology | Version | Purpose |
|-----------|---------|---------|
| PostgreSQL | 13+ | Primary database |
| Drizzle ORM | ^0.38.3 | Database queries |
| node-postgres | ^8.22.0 | DB driver |

### 3.4 External Services

| Service | Purpose |
|---------|---------|
| Notion API | Data synchronization |
| Vercel Blob | Photo/file storage |
| Argon2 | Password hashing |
| Nodemailer | Email notifications |
| pdf-lib | PDF generation |

### 3.5 Security & Utilities

| Library | Version | Purpose |
|---------|---------|---------|
| @node-rs/argon2 | ^2.0.2 | Password hashing |
| clsx | ^2.1.1 | Class names |
| tailwind-merge | ^2.6.0 | CSS merging |

---

## 4. Database Schema

### 4.1 Entity Relationship Diagram

```
┌──────────────┐
│    USERS     │
├──────────────┤
│ id (PK)      │
│ email        │
│ name         │
│ role         │←──────┐
│ password_hash│       │
│ created_at   │       │
└──────────────┘       │
        ▲              │
        │              │
        │              │
        │         ┌────────────┐
        │         │  SURVEYS   │
        │         ├────────────┤
        │         │ id (PK)    │
        └─────────│surveyor_id │
                  │ lead_id    │
                  │ job_id     │
                  │ status     │
                  └────────────┘
                        │
                        │ (References)
                        ▼
                  ┌──────────────┐
                  │    LEADS     │
                  ├──────────────┤
                  │ id (PK)      │
                  │ job_id       │
                  │ customer_name│
                  │ email        │
                  │ address      │
                  │ phone        │
                  │ approval     │
                  └──────────────┘

┌──────────────────────┐
│     PHOTOS           │
├──────────────────────┤
│ id (PK)              │
│ survey_id (FK)       │──→ SURVEYS
│ section              │
│ blob_url             │
│ uploaded_at          │
└──────────────────────┘
```

### 4.2 Database Tables

#### Table 1: USERS

**Purpose**: Store system user credentials and profile information  
**Relations**: Referenced by SURVEYS (surveyor_id)

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PRIMARY KEY | Unique user identifier |
| email | TEXT | UNIQUE, NOT NULL | Login email (case-insensitive) |
| password_hash | TEXT | NOT NULL | Argon2 hashed password |
| name | TEXT | NULLABLE | User full name |
| role | ENUM | NOT NULL | 'surveyor' or 'sales' |
| created_at | TIMESTAMP | NOT NULL | Account creation time |

**Indexes**:
- PRIMARY KEY on `id`
- UNIQUE constraint on `email` (lowercase)

---

#### Table 2: LEADS

**Purpose**: Cache of customer enquiry data from Notion databases  
**Relations**: Referenced by SURVEYS (lead_id)

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PRIMARY KEY | Unique lead identifier |
| job_id | TEXT | UNIQUE, NOT NULL | Treadlight job ID |
| enquiry_page_id | TEXT | NOT NULL | Notion Enquiries DB page ID |
| customer_details_page_id | TEXT | NULLABLE | Notion Customer Details page ID |
| customer_name | TEXT | NULLABLE | Customer name |
| email | TEXT | NULLABLE | Customer email |
| phone | TEXT | NULLABLE | Contact phone |
| address | TEXT | NULLABLE | Installation address |
| postcode | TEXT | NULLABLE | Postal code |
| property_use | ENUM | NULLABLE | 'domestic' or 'commercial' |
| service_interested | TEXT[] | NULLABLE | Array of services |
| initial_estimated_amount | NUMERIC | NULLABLE | Initial quote amount (£) |
| annual_consumption_kwh | TEXT | NULLABLE | Annual energy consumption |
| current_electricity_price | TEXT | NULLABLE | Current energy price |
| pv_installed | BOOLEAN | NULLABLE | Existing PV installation |
| fit_arrangement | BOOLEAN | NULLABLE | FIT eligibility |
| conservation_area | BOOLEAN | NULLABLE | Listed/conservation building |
| council_details | TEXT | NULLABLE | Local authority info |
| notion_status | TEXT | NULLABLE | Current Notion status |
| customer_approval | TEXT | NULLABLE | 'Y'/'N'/pending |
| reason_for_rejection | TEXT | NULLABLE | Rejection reason if applicable |
| synced_at | TIMESTAMP | NOT NULL | Last sync from Notion |

**Indexes**:
- PRIMARY KEY on `id`
- UNIQUE index on `job_id`

---

#### Table 3: SURVEYS

**Purpose**: Store solar PV survey data collected by surveyors  
**Relations**: References LEADS (lead_id), References USERS (surveyor_id), Referenced by PHOTOS

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| **Core Fields** |
| id | UUID | PRIMARY KEY | Unique survey identifier |
| lead_id | UUID | FK → LEADS | Associated lead |
| job_id | TEXT | UNIQUE, NOT NULL | Treadlight job ID |
| surveyor_id | UUID | FK → USERS | Assigned surveyor |
| status | ENUM | NOT NULL | 'draft' or 'submitted' |
| **Site Access & Logistics (Section 3.2)** |
| scaffold_front | BOOLEAN | NULLABLE | Front scaffolding needed |
| scaffold_rear | BOOLEAN | NULLABLE | Rear scaffolding needed |
| scaffold_gable | BOOLEAN | NULLABLE | Gable scaffolding needed |
| scaffold_permit_required | BOOLEAN | NULLABLE | Permit needed |
| **Roof/Structure (Section 3.3)** |
| roof_type | ENUM | NULLABLE | concrete_tile/slate/flat/metal/asbestos |
| roof_pitch_deg | INTEGER | NULLABLE | Roof angle (degrees) |
| roof_azimuth_deg | INTEGER | NULLABLE | Roof orientation (degrees) |
| rafter_thickness_mm | INTEGER | NULLABLE | Rafter thickness (mm) |
| rafter_spacing_mm | INTEGER | NULLABLE | Rafter spacing (mm) |
| rot_present | BOOLEAN | NULLABLE | Wood rot detected |
| multiple_roof_faces | BOOLEAN | NULLABLE | Multiple roof surfaces |
| roof_face_count | INTEGER | NULLABLE | Number of roof faces |
| mount_type | ENUM | NULLABLE | 'roof' or 'ground' |
| **Technical Design (Section 3.4)** |
| viable_system_kw | REAL | NULLABLE | Proposed system size (kW) |
| panel_wattage_w | INTEGER | NULLABLE | Panel wattage (W) |
| panel_quantity | INTEGER | NULLABLE | Number of panels |
| inverter_quantity | INTEGER | NULLABLE | Number of inverters |
| battery_capacity_kwh | REAL | NULLABLE | Battery storage (kWh) |
| pas63100_compliant | BOOLEAN | NULLABLE | PAS 63100 compliance |
| dc_cable_length_m | INTEGER | NULLABLE | DC cable length (meters) |
| ac_cable_length_m | INTEGER | NULLABLE | AC cable length (meters) |
| consumer_unit_spare_ways | INTEGER | NULLABLE | Consumer unit spare ways |
| main_fuse_rating | ENUM | NOT NULL | 60A/80A/100A/other |
| looped_supply | BOOLEAN | NULLABLE | Looped supply present |
| smets2_present | BOOLEAN | NULLABLE | Smart meter present |
| wifi_strength | TEXT | NULLABLE | WiFi signal strength |
| **Labour & Installation (Section 3.5)** |
| labour_man_days | REAL | NULLABLE | Labour estimate (days) |
| groundworks_trenching | BOOLEAN | NULLABLE | Trenching required |
| remedial_works | BOOLEAN | NULLABLE | Remedial work needed |
| **Compliance & Regulations (Section 3.6)** |
| dno_connection | ENUM | NULLABLE | G98 or G99 |
| export_limitation | BOOLEAN | NULLABLE | Export limit required |
| planning_permission_required | BOOLEAN | NULLABLE | Planning needed |
| listed_building | BOOLEAN | NULLABLE | Listed building |
| article4 | BOOLEAN | NULLABLE | Article 4 direction |
| building_regs_parts | TEXT[] | NULLABLE | Building regs parts |
| mcs_applicable | BOOLEAN | NULLABLE | MCS registration applicable |
| **Financial/Operational (Section 3.7)** |
| estimated_yield_kwh | INTEGER | NULLABLE | Annual yield (kWh) |
| cu_upgrade_required | BOOLEAN | NULLABLE | CU upgrade needed |
| tree_trimming_required | BOOLEAN | NULLABLE | Tree trimming needed |
| dno_fees_expected | BOOLEAN | NULLABLE | DNO fees anticipated |
| planning_fees_expected | BOOLEAN | NULLABLE | Planning fees anticipated |
| **Risk & Outcomes (Section 3.8)** |
| asbestos_present | BOOLEAN | NOT NULL | Asbestos detected |
| showstopper_present | BOOLEAN | NOT NULL | Installation blockers |
| ev_future | BOOLEAN | NULLABLE | EV charging planned |
| heatpump_future | BOOLEAN | NULLABLE | Heat pump planned |
| eps_backup | BOOLEAN | NULLABLE | EPS backup available |
| **Metadata** |
| extras | JSONB | NOT NULL | Custom fields (JSON) |
| notion_pushed | BOOLEAN | NOT NULL | Synced to Notion |
| created_at | TIMESTAMP | NOT NULL | Record creation |
| updated_at | TIMESTAMP | NOT NULL | Last update |
| submitted_at | TIMESTAMP | NULLABLE | Submission timestamp |

**Indexes**:
- PRIMARY KEY on `id`
- UNIQUE index on `job_id`
- Foreign keys on `lead_id`, `surveyor_id`

---

#### Table 4: PHOTOS

**Purpose**: Store references to uploaded survey site photographs  
**Relations**: References SURVEYS (survey_id)

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PRIMARY KEY | Unique photo identifier |
| survey_id | UUID | FK → SURVEYS (CASCADE) | Associated survey |
| section | TEXT | NOT NULL | PRD section (e.g., "3.3") |
| blob_url | TEXT | NOT NULL | Vercel Blob storage URL |
| blob_pathname | TEXT | NOT NULL | Storage path identifier |
| caption | TEXT | NULLABLE | Photo description |
| content_type | TEXT | NULLABLE | MIME type (image/jpeg, etc.) |
| size_bytes | INTEGER | NULLABLE | File size in bytes |
| uploaded_at | TIMESTAMP | NOT NULL | Upload timestamp |

**Indexes**:
- PRIMARY KEY on `id`
- Foreign key on `survey_id` with CASCADE delete

---

### 4.3 Enumeration Types

```sql
-- Role Enumeration
role: 'surveyor' | 'sales'

-- Survey Status
survey_status: 'draft' | 'submitted'

-- Roof Types
roof_type: 'concrete_tile' | 'slate' | 'flat' | 'metal' | 'asbestos'

-- Main Fuse Rating
main_fuse_rating: '60A' | '80A' | '100A' | 'other'

-- DNO Connection
dno_connection: 'G98' | 'G99'

-- Property Use
property_use: 'domestic' | 'commercial'

-- Mount Type
mount_type: 'roof' | 'ground'
```

### 4.4 Data Relationships & Constraints

**One-to-Many Relationships:**
- User → Surveys (One surveyor can have multiple surveys)
- Lead → Survey (One lead has one survey)
- Survey → Photos (One survey has multiple photos)

**Foreign Key Constraints:**
- `SURVEYS.surveyor_id` → `USERS.id`
- `SURVEYS.lead_id` → `LEADS.id`
- `PHOTOS.survey_id` → `SURVEYS.id` (CASCADE on delete)

**Unique Constraints:**
- `LEADS.job_id` (No duplicate job IDs)
- `SURVEYS.job_id` (One survey per job)
- `USERS.email` (No duplicate emails)

---

## 5. User Roles & Workflows

### 5.1 User Roles

#### Role 1: SURVEYOR
**Permissions**: View assigned jobs, complete surveys, upload photos  
**Access Path**: Login → Jobs Dashboard → Job Details → Survey Form

**Capabilities**:
- View assigned surveys
- Fill survey form (multiple sections)
- Upload site photographs
- Submit completed survey
- View job details (customer info, address)

**Restrictions**:
- Cannot see unassigned jobs
- Cannot approve surveys
- Cannot access sales data
- Cannot manage users

---

#### Role 2: SALES TEAM
**Permissions**: Manage approvals, assign surveyors, generate quotations  
**Access Path**: Login → Sales Dashboard

**Capabilities**:
- View all customer enquiries
- Approve/reject survey requests
- Assign surveyors to jobs
- View submitted surveys
- Review quotations
- Generate reports
- Manage system users (Admin)
- Filter surveys by specifications

**Restrictions**:
- Cannot submit surveys
- Cannot upload photos
- Cannot modify survey data

---

#### Role 3: ADMIN (Sales Team Feature)
**Permissions**: User account management  
**Access Path**: Login → Sales Dashboard → Header Menu → Admin

**Capabilities**:
- Create new user accounts
- Edit user details (name, role)
- Reset user passwords
- Delete user accounts
- View all system users

**Restrictions**:
- Cannot delete own account
- Cannot access surveyor jobs

---

### 5.2 Approval Workflow

```
┌─────────────────────┐
│ Customer Enquiry    │
│ (from Notion)       │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────────────────────────┐
│ SALES TEAM - Survey Approvals Page      │
│ /sales/survey-approvals                 │
├─────────────────────────────────────────┤
│ Shows:                                  │
│ - All enquiries with status             │
│ - Customer details                      │
│ - Initial estimate                      │
│ - Services interested                   │
└──────────┬──────────────────────────────┘
           │
     ┌─────┴─────┐
     │           │
     ▼           ▼
 APPROVE      REJECT
     │           │
     ▼           ▼
┌────────┐  ┌──────────┐
│ SELECT │  │ RECORD   │
│SURVEYOR│  │ REASON   │
└────┬───┘  └─────┬────┘
     │            │
     ▼            ▼
┌─────────────────────────────────────────┐
│ SURVEY ASSIGNED                         │
│ - Surveyor receives job notification    │
│ - Job appears in Surveyor Dashboard     │
│ - Status updated in Notion              │
└─────────────────────────────────────────┘
     │
     ▼
┌──────────────────────────────────────────┐
│ SURVEYOR - Completes Survey              │
│ /jobs/[jobId]                            │
├──────────────────────────────────────────┤
│ - Fill survey form (8 sections)          │
│ - Upload site photographs                │
│ - Submit survey                          │
└──────────┬───────────────────────────────┘
           │
           ▼
┌──────────────────────────────────────────┐
│ SURVEY SUBMITTED                         │
│ - Data saved to database                 │
│ - Photos stored in Blob storage          │
│ - Proposal generated                     │
│ - Appears in "Sales-Pitch" list          │
└──────────┬───────────────────────────────┘
           │
           ▼
┌──────────────────────────────────────────┐
│ SALES TEAM - Final Quotation             │
│ /sales/final-quotation                   │
├──────────────────────────────────────────┤
│ - Review completed survey data           │
│ - Review quotation proposal              │
│ - Approve/Reject final quotation         │
└──────────┬───────────────────────────────┘
           │
     ┌─────┴─────────┐
     │               │
     ▼               ▼
 APPROVED        REJECTED
     │               │
     ▼               ▼
┌────────────┐  ┌──────────┐
│ CONTRACT   │  │REVISE &  │
│SIGNED      │  │RESUBMIT  │
└────────────┘  └──────────┘
```

---

## 6. User Manual by Role

### 6.1 SURVEYOR USER MANUAL

#### Getting Started

**Step 1: Login**
1. Navigate to: https://survey-engineering-app.vercel.app/login
2. Enter email and password
3. Click "Sign In"

**Step 2: Dashboard Overview**
- You see "Your Assigned Surveys"
- Shows all jobs assigned to you by sales team
- Each card shows:
  - Customer name
  - Job ID
  - Address
  - Property type
  - Services required
  - Survey status (Not started/Draft/Submitted)

#### Viewing a Survey Job

**To open a survey:**
1. Click on any job card
2. Or click "View →" button
3. You're taken to survey form page

**Job Details Shown:**
- Customer name (heading)
- Customer email & phone
- Installation address
- Property details

#### Completing the Survey Form

**Survey has 8 Main Sections:**

**Section 3.2: Site Access & Logistics**
- Scaffolding requirements (front, rear, gable)
- Permit requirements
- Estimated setup time

**Section 3.3: Roof & Structure**
- Roof type (tile, slate, flat, metal, asbestos)
- Roof angle & orientation
- Rafter specifications
- Structural issues (rot, damage)
- Number of roof faces

**Section 3.4: Technical Design**
- Proposed system size (kW)
- Panel wattage & quantity
- Inverter count
- Battery storage (kWh)
- Cable lengths
- Consumer unit specifications
- Main fuse rating (REQUIRED)

**Section 3.5: Labour & Installation**
- Estimated labor days
- Groundwork requirements
- Remedial work needed

**Section 3.6: Compliance & Regulations**
- DNO connection type (G98/G99)
- Planning permission needed
- Listed building status
- Building regulations requirements

**Section 3.7: Financial Outcomes**
- Estimated annual yield
- Upgrade requirements
- Expected fees

**Section 3.8: Risk Assessment**
- Asbestos present (REQUIRED)
- Installation blockers (REQUIRED)
- Future EV/heat pump plans

#### Uploading Photos

**For Each Section:**
1. Photos section available below form fields
2. Click "Upload Photos" button
3. Select image files from device
4. Add caption (optional)
5. Photos stored with section reference
6. Can upload multiple photos per section

**Photo Requirements:**
- Clear, well-lit photos
- Show relevant site areas
- Include captions for reference
- Recommended: 5-10 photos minimum

#### Submitting Survey

**Before Submission:**
1. Ensure all REQUIRED fields filled:
   - Main fuse rating
   - Asbestos present
   - Showstopper present
2. Review all information
3. Ensure all necessary photos uploaded

**To Submit:**
1. Scroll to bottom of form
2. Click "Submit Survey" button
3. Survey locked from editing
4. Confirmation message displayed
5. Sales team notified automatically

**After Submission:**
- Status changes to "Submitted"
- Surveyor cannot edit survey
- Sales team reviews quotation
- Job appears in sales "Sales-Pitch" list

#### Troubleshooting Surveyor Issues

**Problem**: "Job not assigned to me"
- **Solution**: Contact your manager. Job must be assigned in admin panel first.

**Problem**: Cannot see photo upload
- **Solution**: Scroll down in the survey form section

**Problem**: "Validation error - main fuse rating required"
- **Solution**: Scroll to Section 3.4 and select main fuse rating

---

### 6.2 SALES TEAM USER MANUAL

#### Dashboard Overview

**Sales Dashboard** (`/sales`)
Shows three main sections:

1. **Header Navigation Menu**
   - Sales-Pitch: View completed surveys
   - Survey Approvals: Review new enquiries
   - Final Quotation: Approve quotations
   - Reports: View project reports
   - Admin: Manage system users

2. **Sales-Pitch List**
   - All submitted surveys ready for quotation
   - Filter by specifications
   - View detailed survey data

#### Survey Approvals Workflow

**Accessing Survey Approvals:**
1. Click "Survey Approvals" in header menu
2. See all pending customer enquiries
3. Shows approval status (Approved/Rejected/Awaiting)

**For Each Enquiry:**
- Customer name
- Job ID
- Initial estimate amount
- Services interested
- Current approval status

**To Approve & Assign Surveyor:**

1. Click "Approve (Y)" button
2. Surveyor selection panel appears
3. Choose surveyor from dropdown
   - Shows all available surveyors
   - Or shows single surveyor if only one exists
4. Click "Confirm Approval"
5. Survey assigned to selected surveyor
6. Surveyor notified automatically

**To Reject Enquiry:**

1. Click "Reject (N)" button
2. Rejection reason panel appears
3. Type rejection reason (required)
4. Click "Confirm Rejection"
5. Status changes to "Rejected"
6. Reason displayed below button

#### Sales-Pitch (Completed Surveys)

**Purpose**: Review completed surveys and prepare quotations

**Features:**
- Filter by main fuse rating
- Filter by roof type
- Filter by asbestos present/absent
- View detailed survey data

**For Each Survey:**
1. Click customer name or "View →"
2. See:
   - All survey form data
   - Uploaded photographs
   - Technical specifications
   - Compliance information
3. Generate quotation proposal
4. Prepare pricing

#### Final Quotation Approval

**Accessing Final Quotations:**
1. Click "Final Quotation" in header menu
2. See customer details ready for quotation
3. Shows: customer name, job ID, address

**To Approve Quotation:**
1. Review customer details
2. Review technical survey data
3. Click "Approve for Final Quotation"
4. Final quotation status set to "Approved"
5. Contract preparation begins

**To Reject Quotation:**
1. Click "Reject" button
2. Enter rejection reason
3. Survey returns for revision

#### Reports

**Generate Reports:**
1. Click "Reports" in header menu
2. View:
   - Survey completion statistics
   - Surveyor performance
   - Customer approval rates
   - Timeline analytics
3. Export reports (if enabled)

---

### 6.3 ADMIN PANEL USER MANUAL

#### Accessing Admin Panel

**Steps:**
1. Login as sales team member
2. Click "Admin" in header navigation menu
3. Admin Control Panel loads

#### Admin Dashboard

**Shows:**
- All system users (surveyors & sales team)
- User email addresses
- User roles
- Creation dates
- User count

#### Creating New User

**To Add User:**

1. Click "Create New User" button
2. Fill form:
   - **Email**: User's login email (required)
   - **Password**: Temporary password (required)
   - **Name**: Full name (optional)
   - **Role**: Select "Surveyor" or "Sales Team" (required)
3. Click "Create User"
4. Confirmation message
5. User can login immediately
6. User should change password after first login

**User Email Format:**
- Can be any valid email
- Used for login (case-insensitive)
- Must be unique

#### Editing User Details

**To Edit User:**

1. Find user in list
2. Click "Edit" button
3. Update:
   - **Name**: Change full name
   - **Role**: Switch between Surveyor/Sales
4. Click "Save"
5. Changes applied immediately

#### Resetting Password

**If User Forgets Password:**

1. Find user in list
2. Click "Reset Password" button
3. Enter new temporary password
4. Click "Confirm Reset"
5. Password changed
6. User can login with new password
7. User should change password after login

**Password Recommendations:**
- Minimum 8 characters
- Include uppercase & lowercase letters
- Include numbers
- Require users to change on first login

#### Deleting User

**To Remove User:**

1. Find user in list
2. Click "Delete" button
3. Confirmation warning displayed
4. Confirm deletion
5. User account deleted
6. User cannot login anymore
7. All surveys assigned to user remain in database
8. Cannot delete own account (restriction)

#### Managing Roles

**Surveyor Role:**
- Can view assigned jobs
- Can complete surveys
- Cannot see other surveyors' jobs
- Cannot access sales data

**Sales Team Role:**
- Can view all enquiries
- Can approve/reject surveys
- Can assign surveyors
- Can review quotations
- Can access admin panel

**To Change User Role:**
1. Click "Edit" on user
2. Select new role from dropdown
3. Click "Save"
4. Role changes immediately
5. User permissions update

#### User Management Best Practices

- **Regular Audits**: Review users monthly
- **Inactive Accounts**: Delete accounts for inactive staff
- **Password Policy**: Enforce regular password changes
- **Access Control**: Assign correct roles based on job function
- **Documentation**: Track when users added/removed
- **Backup Access**: Ensure at least 2 sales users for continuity

---

## 7. Feature Guide

### 7.1 Photo Upload Feature

**How It Works:**
- Each survey section can have multiple photos
- Photos stored in Vercel Blob storage (cloud)
- Photos linked to survey section reference
- Supports JPG, PNG formats
- Recommended size: 2-5MB per photo

**Best Practices:**
- Clear, well-lit photography
- Include scale reference where possible
- Captions for photo context
- Minimum 1 photo per section
- Maximum 20 photos per survey

### 7.2 Survey Form Validation

**Required Fields (Block Submission):**
- Main fuse rating (Section 3.4)
- Asbestos present (Section 3.8)
- Showstopper present (Section 3.8)

**Recommended Fields:**
- All roof specifications
- Technical system details
- Compliance information

**Error Messages:**
- "Required field missing" → Complete mandatory field
- "Invalid value" → Check data format
- "Field locked after submit" → Cannot edit submitted survey

### 7.3 Notion Integration

**Automatic Sync:**
- Lead data synced from Notion Enquiries DB
- Customer details pulled from Notion Customer Details DB
- Status updates pushed to Notion
- Two-way synchronization

**Sync Frequency:**
- Leads: Real-time
- Status updates: Immediate
- Photos: On submission

### 7.4 Report Generation

**Available Reports:**
- Survey completion timeline
- Surveyor assignments
- Approval statistics
- Quality metrics

**Data Included:**
- Job IDs
- Customer names
- Completion dates
- Surveyor names
- Approval rates

---

## 8. API & Integration

### 8.1 Server Actions (Backend API)

All operations use Next.js Server Actions for API calls.

#### Approval Actions (`/actions/approval.ts`)

```typescript
// Approve customer survey
approveCustomer(enquiryPageId: string, surveyorId?: string)
- Updates customer approval to 'Y'
- Creates/updates survey with assigned surveyor
- Syncs leads from Notion
- Revalidates survey page

// Reject customer survey
rejectCustomer(enquiryPageId: string, reason: string)
- Sets customer approval to 'N'
- Records rejection reason
- Updates Notion database
- Returns confirmation
```

#### User Management Actions (`/actions/users.ts`)

```typescript
// Get all users
getAllUsers()
- Returns list of all system users
- Includes email, name, role, created_at

// Create new user
createUser(email, password, name, role)
- Validates email uniqueness
- Hashes password with Argon2
- Stores in database
- Returns confirmation

// Update user
updateUser(userId, name, role)
- Updates user details
- Changes user role
- Returns confirmation

// Reset password
resetUserPassword(userId, newPassword)
- Hashes new password
- Updates database
- Returns confirmation

// Delete user
deleteUser(userId)
- Removes user account
- Prevents self-deletion
- Returns confirmation
```

#### Survey Actions (`/actions/survey.ts`)

```typescript
// Get survey by job ID
getSurveyByJobId(jobId: string)
- Returns survey data
- Includes all form fields

// Create/get draft survey
getOrCreateDraft(jobId, surveyorId, leadId)
- Creates new draft if not exists
- Returns survey object

// Get survey photos
getSurveyPhotos(surveyId: string)
- Returns all photos for survey
- Ordered by upload date

// Submit survey
submitSurvey(surveyId: string)
- Marks survey as submitted
- Prevents further edits
- Triggers Notion sync
```

### 8.2 External Integrations

#### Notion API Integration

**Databases Synced:**
1. **Treadlight Website Enquiries**
   - Customer approval field
   - Job status
   - Rejection reason
   - Survey completion status

2. **Customer Details**
   - Final quotation approval
   - Status tracking
   - Contract information

**Sync Points:**
- On survey approval
- On survey submission
- On quotation approval
- Hourly background sync

#### Vercel Blob Integration

**Usage:**
- Store uploaded survey photos
- Store PDF documents
- Cloud-based storage
- Accessible via signed URLs

**File Limits:**
- Maximum 100MB per file
- Retention: Unlimited
- CDN-enabled for fast access

#### Password Security (Argon2)

**Algorithm:** Argon2id
**Hash Time:** 50-100ms
**Memory:** 64MB
**Iterations:** Automatic optimization

---

## 9. Troubleshooting

### 9.1 Common Issues & Solutions

#### Login Issues

| Problem | Solution |
|---------|----------|
| Email not recognized | Check email is correct & associated with account |
| Password incorrect | Use "Forgot Password" if available, or contact admin |
| Account locked | Contact admin to unlock |
| Cannot remember credentials | Admin can reset password |

#### Survey Issues

| Problem | Solution |
|---------|----------|
| Cannot see assigned jobs | Check assignment in admin panel |
| Form won't submit | Verify all required fields filled (fuse, asbestos, showstopper) |
| Photos not uploading | Check file size (<5MB), format (JPG/PNG), connection |
| Data not saving | Check internet connection, try refreshing page |
| Cannot edit submitted survey | Submitted surveys are locked (contact admin if needed) |

#### Approval Issues

| Problem | Solution |
|---------|----------|
| Cannot see enquiries | Check user role (must be sales) |
| Surveyor list empty | Contact admin to create surveyor accounts |
| Approval not saving | Check internet connection, try again |
| Synchronization delayed | Notion sync may take 5-10 minutes |

#### Photo Issues

| Problem | Solution |
|---------|----------|
| Photo won't upload | Check: file format (JPG/PNG), size (<5MB), internet |
| Photo URL broken | Blob storage token may be invalid; contact admin |
| Cannot add caption | Try refreshing page, or adding in bulk |
| Photos disappear after submit | They are stored in blob; reload page to see URLs |

#### Admin Issues

| Problem | Solution |
|---------|----------|
| Cannot access admin | Must be sales role; check role in database |
| User creation fails | Email may already exist; try different email |
| Cannot delete user | Check: user not yourself, user exists |
| Password reset fails | Check: new password meets requirements, user exists |

### 9.2 Performance Optimization

**For Faster Load Times:**
1. Clear browser cache (Ctrl+Shift+Delete)
2. Use latest browser version
3. Check internet connection speed
4. Disable browser extensions
5. Clear cookies

**For Large Photo Uploads:**
1. Compress images before upload (use online tool)
2. Upload during off-peak hours
3. Split large batches into smaller uploads
4. Check internet stability

### 9.3 Support Contacts

**For Technical Issues:**
- Contact: your-support@elmechltd.co.uk
- Response time: Within 24 hours

**For User Management:**
- Contact: admin-support@elmechltd.co.uk
- Available: Monday-Friday, 9AM-5PM

**For Emergency Issues:**
- On-call support available
- Priority escalation available

---

## 10. Support & Help

### 10.1 Documentation Resources

| Resource | Purpose |
|----------|---------|
| [GitHub Repository](https://github.com/annishr-pixel/Survey_Engineering_App) | Source code & latest version |
| Project Manual | This document (complete reference) |
| Video Tutorials | Step-by-step walkthroughs (if available) |
| FAQ Page | Common questions answered |

### 10.2 Getting Help

**Before Contacting Support:**
1. Check this manual (use Table of Contents)
2. Try troubleshooting steps (Section 9)
3. Clear browser cache & try again
4. Test in different browser
5. Verify internet connection

**When Contacting Support:**
Provide:
- Your username/email
- Device & browser (e.g., Windows 11, Chrome)
- Exact error message
- Steps to reproduce issue
- Screenshots if possible

### 10.3 Feedback & Suggestions

We welcome feedback to improve the application:
- Feature requests
- UI/UX suggestions
- Bug reports
- Documentation improvements

**Send Feedback To:**
- Email: feedback@elmechltd.co.uk
- Subject: "App Feedback: [Topic]"

### 10.4 Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | Jul 2026 | Initial release with surveyor assignment & admin features |
| 0.9 | Jun 2026 | Survey form & photo upload |
| 0.8 | May 2026 | Approval workflow |
| 0.7 | Apr 2026 | MVP with basic features |

---

## Appendix A: Quick Reference

### User Roles Quick Guide

```
SURVEYOR:
├── Login required
├── View assigned jobs
├── Complete survey form
├── Upload photos
└── Submit survey

SALES TEAM:
├── Login required
├── Approve/reject surveys
├── Assign surveyors
├── View quotations
├── Approve quotations
└── Access admin (via Admin panel)

ADMIN (Sales Team Feature):
├── Create user accounts
├── Edit user details
├── Reset passwords
└── Delete user accounts
```

### Important URLs

| Page | URL |
|------|-----|
| Login | `/login` |
| Surveyor Dashboard | `/jobs` |
| Survey Form | `/jobs/[jobId]` |
| Sales Dashboard | `/sales` |
| Survey Approvals | `/sales/survey-approvals` |
| Final Quotation | `/sales/final-quotation` |
| Admin Panel | `/sales/admin` |
| Reports | `/sales/reports` |

### Required Database Fields

```
Users Table:
✓ email (unique, case-insensitive)
✓ password_hash (Argon2)
✓ role ('surveyor' or 'sales')

Surveys Table:
✓ main_fuse_rating (Section 3.4)
✓ asbestos_present (Section 3.8)
✓ showstopper_present (Section 3.8)

Approvals:
✓ customer_approval ('Y'/'N'/null)
✓ surveyor_id (for assignment)
```

---

## Appendix B: Glossary

| Term | Definition |
|------|-----------|
| DNO | Distribution Network Operator (electricity provider) |
| G98/G99 | DNO application forms for generating installation |
| Inverter | Converts DC to AC power |
| kW | Kilowatt (power unit) |
| kWh | Kilowatt-hour (energy unit) |
| Lead | Potential customer enquiry |
| MCS | Microgeneration Certification Scheme |
| PV | Photovoltaic (solar panels) |
| Showstopper | Installation blocker/major issue |
| Surveyor | Field technician conducting site surveys |

---

## Appendix C: Contact Information

**Company:** Treadlight Limited  
**Email:** support@elmechltd.co.uk  
**Support Hours:** Monday-Friday, 9AM-5PM GMT

**Project Repository:**  
https://github.com/annishr-pixel/Survey_Engineering_App

---

**Document Version:** 1.0  
**Last Updated:** July 24, 2026  
**Next Review:** October 24, 2026

*This manual is subject to updates as features are added or modified. Users will be notified of significant changes.*
